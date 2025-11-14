import { NextRequest, NextResponse } from 'next/server';
import { callGrok, RateLimitError } from '@/lib/clients/grok';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { supabase } from '@/lib/supabase';
import { getClaudeEmbedding } from '@/lib/embeddings';

export const dynamic = 'force-dynamic';

type ErrorCapture = {
	stack: string;
	file?: string;
	message?: string;
	[key: string]: any;
};

type FixSuggestion = {
	explanation: string;
	tradeoffs: string[];
	diff: {
		path: string;
		delta: string;
	};
};

type DebugResponse = {
	explanation: string;
	fixes: FixSuggestion[];
};

// Helper to detect complex errors (async stack traces, etc.)
function isComplexError(error: ErrorCapture): boolean {
	const stack = error.stack || '';
	// Check for async patterns
	return (
		stack.includes('async') ||
		stack.includes('Promise') ||
		stack.includes('await') ||
		stack.includes('then(') ||
		stack.includes('catch(') ||
		stack.split('\n').length > 10 // Long stack traces
	);
}

// Collect Grok response (non-streaming for initial analysis)
async function callGrokCollect(model: 'grok-4', prompt: string, maxRetries = 3): Promise<string> {
	let text = '';
	let retryCount = 0;
	
	while (retryCount <= maxRetries) {
		try {
			text = '';
			for await (const chunk of callGrok(model, prompt)) {
				if (chunk.type === 'text' && chunk.text) {
					text += chunk.text;
				}
			}
			return text;
		} catch (error: any) {
			if (error instanceof RateLimitError && retryCount < maxRetries) {
				const waitMs = error.retryAfterMs || 1000 * (retryCount + 1);
				console.log(`[debug] Rate limit hit, retrying after ${waitMs}ms (attempt ${retryCount + 1}/${maxRetries})`);
				await new Promise(resolve => setTimeout(resolve, waitMs));
				retryCount++;
				continue;
			}
			throw error;
		}
	}
	
	return text;
}

// Call Claude for tradeoff analysis
async function callClaudeForTradeoffs(
	grokOutput: string,
	error: ErrorCapture,
	vibe?: string
): Promise<string> {
	const anthropic = createAnthropic({
		apiKey: process.env.AI_GATEWAY_API_KEY ?? process.env.ANTHROPIC_API_KEY,
		baseURL: process.env.AI_GATEWAY_API_KEY
			? 'https://ai-gateway.vercel.sh/v1'
			: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1',
	});
	
	const modelName = process.env.ANTHROPIC_SONNET_MODEL || 'claude-3-5-sonnet-20241022';
	
	const system = `You are a senior engineer analyzing bug fixes. Review the initial fixes proposed and provide detailed tradeoff analysis. For each fix, identify specific pros and cons. Output JSON only with the same structure: {explanation, fixes: [{explanation, tradeoffs: ['pro1', 'con1', ...], diff: {path, delta}}]}.`;
	
	const user = `Initial fix analysis:\n${grokOutput}\n\nOriginal error: ${error.stack || error.message || 'Unknown error'}\n\nProvide refined tradeoffs for each fix. Vibe: ${vibe || 'balanced'}`;
	
	const result = await generateText({
		model: anthropic(modelName),
		messages: [
			{ role: 'system', content: system },
			{ role: 'user', content: user }
		],
		maxOutputTokens: 4096,
		temperature: 0.3
	});
	
	return result.text || '';
}

// Parse JSON from model response
function parseJSONResponse(text: string): DebugResponse | null {
	try {
		// Try direct parse first
		const parsed = JSON.parse(text);
		return parsed;
	} catch {
		// Try to extract JSON from markdown code blocks or surrounding text
		const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || text.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			try {
				return JSON.parse(jsonMatch[1] || jsonMatch[0]);
			} catch {
				// Fall through
			}
		}
	}
	return null;
}

// Upsert fix to quality_graph
async function upsertFixToQualityGraph(
	fix: FixSuggestion,
	error: ErrorCapture,
	vibe?: string,
	userId?: string
): Promise<void> {
	try {
		const text = [
			'Correction',
			vibe ? `Vibe: ${vibe}` : '',
			`Error: ${error.stack || error.message || 'Unknown'}`,
			`File: ${error.file || 'unknown'}`,
			`Explanation: ${fix.explanation}`,
			`Tradeoffs: ${fix.tradeoffs.join(', ')}`,
			`Diff:\n${fix.diff.delta}`
		].filter(Boolean).join('\n\n');
		
		const embedding = await getClaudeEmbedding(text);
		
		await supabase.from('quality_graph').insert({
			user_id: userId || null,
			type: 'correction',
			embedding,
			content: {
				prompt: `Fix for error in ${error.file || 'unknown'}`,
				diff: fix.diff.delta,
				vibe,
				explanation: fix.explanation,
				tradeoffs: fix.tradeoffs,
				error: error.stack || error.message
			}
		});
	} catch (error) {
		console.error('[debug] Failed to upsert to quality_graph:', error);
		// Don't throw - this is non-critical
	}
}

export async function POST(request: NextRequest) {
	try {
		const { error, model = 'dual', vibe, userId } = await request.json();
		
		if (!error || typeof error !== 'object') {
			return NextResponse.json({ error: 'error object is required' }, { status: 400 });
		}
		
		const errorCapture = error as ErrorCapture;
		if (!errorCapture.stack) {
			return NextResponse.json({ error: 'error.stack is required' }, { status: 400 });
		}
		
		// Build prompt
		const prompt = `Bug: ${errorCapture.stack} in ${errorCapture.file || 'unknown file'}. Explain simply, gen 3 fixes as JSON [{explanation, tradeoffs:['pro','con'], diff:{path,delta}}]. Vibe: ${vibe || 'balanced'}`;
		
		const system = `You are a senior debugging assistant. Given a bug report, explain the root cause simply, then propose exactly 3 fix options. Each fix must include:
- explanation: brief description
- tradeoffs: array of pros and cons (e.g., ['Fast fix', 'May break edge cases'])
- diff: {path: string, delta: string} where delta is a unified diff format

Output JSON only: {explanation: string, fixes: [{explanation, tradeoffs: string[], diff: {path, delta}}]}`;
		
		const grokPrompt = `SYSTEM:\n${system}\n\nUSER:\n${prompt}`;
		
		// Create streaming response
		const encoder = new TextEncoder();
		const stream = new TransformStream();
		const writer = stream.writable.getWriter();
		
		const sendChunk = async (data: any) => {
			const message = `data: ${JSON.stringify(data)}\n\n`;
			await writer.write(encoder.encode(message));
		};
		
		// Process in background
		(async () => {
			try {
				// Step 1: Get Grok response
				await sendChunk({ type: 'status', message: 'Analyzing error with Grok-4...' });
				
				let grokText = '';
				try {
					grokText = await callGrokCollect('grok-4', grokPrompt);
				} catch (grokError: any) {
					if (grokError instanceof RateLimitError) {
						await sendChunk({ type: 'error', error: 'Rate limit exceeded. Please try again later.' });
						await writer.close();
						return;
					}
					throw grokError;
				}
				
				let parsed = parseJSONResponse(grokText);
				
				// Step 2: If complex error and dual mode, chain Claude
				const isComplex = isComplexError(errorCapture);
				if (model === 'dual' && isComplex && parsed) {
					await sendChunk({ type: 'status', message: 'Refining tradeoffs with Claude-3.5...' });
					
					try {
						const claudeText = await callClaudeForTradeoffs(grokText, errorCapture, vibe);
						const claudeParsed = parseJSONResponse(claudeText);
						if (claudeParsed && claudeParsed.fixes && claudeParsed.fixes.length > 0) {
							parsed = claudeParsed;
						}
					} catch (claudeError) {
						console.error('[debug] Claude refinement failed, using Grok output:', claudeError);
						// Continue with Grok output
					}
				}
				
				// Step 3: Validate and stream fixes
				if (!parsed || !Array.isArray(parsed.fixes)) {
					await sendChunk({ type: 'error', error: 'Failed to parse fixes from model response' });
					await writer.close();
					return;
				}
				
				// Stream fixes as they're processed
				await sendChunk({
					type: 'explanation',
					explanation: parsed.explanation || 'No explanation provided'
				});
				
				// Stream each fix
				for (let i = 0; i < parsed.fixes.length; i++) {
					const fix = parsed.fixes[i];
					
					// Validate fix structure
					if (!fix.explanation || !Array.isArray(fix.tradeoffs) || !fix.diff || !fix.diff.path || !fix.diff.delta) {
						console.warn(`[debug] Skipping invalid fix at index ${i}`);
						continue;
					}
					
					// Upsert to quality_graph (non-blocking)
					upsertFixToQualityGraph(fix, errorCapture, vibe, userId).catch(err => {
						console.error(`[debug] Failed to upsert fix ${i}:`, err);
					});
					
					// Stream the fix
					await sendChunk({
						type: 'fix',
						index: i,
						fix: {
							explanation: fix.explanation,
							tradeoffs: fix.tradeoffs,
							diff: fix.diff
						}
					});
				}
				
				// Send completion
				await sendChunk({ type: 'complete', count: parsed.fixes.length });
				
			} catch (error: any) {
				console.error('[debug] Processing error:', error);
				await sendChunk({ type: 'error', error: error?.message || 'Internal error' });
			} finally {
				await writer.close();
			}
		})();
		
		// Return streaming response
		return new Response(stream.readable, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				'Connection': 'keep-alive',
				'Transfer-Encoding': 'chunked',
				'X-Accel-Buffering': 'no'
			}
		});
		
	} catch (error: any) {
		console.error('[debug] Route error:', error);
		return NextResponse.json({ error: error?.message || 'Internal Error' }, { status: 500 });
	}
}
