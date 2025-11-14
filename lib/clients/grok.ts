import type { ReadableStreamDefaultReader } from 'stream/web';

export type GrokModel = 'grok-4' | 'grok-code-fast-1';

export interface GrokTool {
	// Pass-through to x.ai tools schema; caller ensures correctness
	[key: string]: any;
}

export interface GrokStreamChunk {
	type: 'text' | 'tool_call' | 'done';
	text?: string;
	// Include raw payload for advanced handling if needed
	raw?: any;
}

export class RateLimitError extends Error {
	public readonly retryAfterMs?: number;
	constructor(message: string, retryAfterMs?: number) {
		super(message);
		this.name = 'RateLimitError';
		this.retryAfterMs = retryAfterMs;
	}
}

/**
 * Calls xAI Grok chat completions API with streaming.
 * - Streams text deltas via an async generator
 * - Supports passing JSON tools (e.g., for diffs/images) transparently
 * - Handles rate limit errors with Retry-After if provided
 */
export async function* callGrok(
	model: GrokModel,
	prompt: string,
	tools?: GrokTool[]
): AsyncGenerator<GrokStreamChunk> {
	const apiKey = process.env.XAI_API_KEY || process.env.XAI_TOKEN || process.env.GROK_API_KEY;
	if (!apiKey) {
		throw new Error('Missing XAI_API_KEY (or XAI_TOKEN/GROK_API_KEY) environment variable.');
	}

	const body: any = {
		model,
		// We send a single user message composed by the caller; prepend system text there if needed.
		messages: [{ role: 'user', content: prompt }],
		stream: true,
		// temperature kept reasonable; caller can embed control via prompt if needed
		temperature: 0.7
	};

	if (Array.isArray(tools) && tools.length > 0) {
		body.tools = tools;
		// If using tools, request tool choice auto so model can emit tool calls
		body.tool_choice = 'auto';
	}

	const response = await fetch('https://api.x.ai/v1/chat/completions', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	});

	if (!response.ok) {
		// Handle rate limits explicitly
		if (response.status === 429) {
			const retryAfterHeader = response.headers.get('retry-after') || response.headers.get('x-ratelimit-reset');
			const retryAfterMs = retryAfterHeader ? parseInt(retryAfterHeader, 10) * (retryAfterHeader.includes('.') ? 1000 : 1000) : undefined;
			throw new RateLimitError('xAI Grok rate limit exceeded', retryAfterMs);
		}
		let errorText: string | undefined;
		try {
			errorText = await response.text();
		} catch {
			// ignore
		}
		throw new Error(`Grok API error (${response.status}): ${errorText || response.statusText}`);
	}

	// Stream parsing: xAI returns server-sent events style with "data: {json}\n\n"
	const reader: ReadableStreamDefaultReader<Uint8Array> = response.body!.getReader();
	const decoder = new TextDecoder('utf-8');
	let buffer = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });

		// Split on double newlines typical to SSE framing
		const events = buffer.split('\n\n');
		// Keep the last partial chunk in buffer
		buffer = events.pop() ?? '';

		for (const event of events) {
			// Each event may contain multiple lines; we care about lines starting with "data:"
			const lines = event.split('\n');
			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed.startsWith('data:')) continue;
				const payloadStr = trimmed.slice(5).trim();
				if (payloadStr === '[DONE]') {
					yield { type: 'done' };
					return;
				}
				try {
					const payload = JSON.parse(payloadStr);
					// Compatible with OpenAI-like deltas: choices[].delta.content / tool_calls
					const choice = payload?.choices?.[0];
					const delta = choice?.delta;
					if (delta?.content) {
						yield { type: 'text', text: delta.content as string, raw: payload };
					} else if (delta?.tool_calls) {
						// Surface tool calls for upstream handling if needed
						yield { type: 'tool_call', raw: payload };
					} else if (choice?.message?.content) {
						// Non-delta final messages (in case streaming behaves differently)
						yield { type: 'text', text: choice.message.content as string, raw: payload };
					}
				} catch {
					// If JSON parse fails, ignore this line silently
				}
			}
		}
	}

	// Flush remaining buffer if any holds a terminal [DONE]
	if (buffer.includes('[DONE]')) {
		yield { type: 'done' };
	}
}


