import { NextRequest, NextResponse } from 'next/server';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { callGrok } from '@/lib/clients/grok';

export const dynamic = 'force-dynamic';

type Vibe = 'scrappy' | 'enterprise' | 'dual' | undefined;

function decideRoute(prompt: string, vibe?: Vibe, mode?: string): 'grok' | 'claude' | 'dual' {
	const lower = (prompt || '').toLowerCase();
	if (mode === 'dual' || vibe === 'dual') return 'dual';
	if (vibe === 'scrappy') return 'grok';
	if (vibe === 'enterprise') return 'claude';
	if (lower.includes('build') || lower.includes('creative')) return 'grok';
	if (lower.includes('refine') || lower.includes('harden')) return 'claude';
	return 'grok';
}

function buildSystemPrompt(context: { scraped?: string } = {}) {
	const scrapeSection = context.scraped
		? `\n\nSCRAPED CONTENT CONTEXT (reference only):\n${context.scraped.substring(0, 8000)}\n`
		: '';
	return `You are a senior full-stack engineer. Generate clean, complete files for a Vite React project using Tailwind utilities only where applicable.
Output using XML tags and include explanation and tests tags. The tests must be runnable with Vitest or Jest:
<file path="...">FULL FILE CONTENT</file>
<explanation>Short explanation of changes/approach</explanation>
<tests>A runnable Vitest or Jest test suite validating the request</tests>
${scrapeSection}
Rules:
- Do not truncate code.
- Prefer minimal changes for edits; return full file contents.
- Use only standard Tailwind classes (no bg-background/text-foreground).
- If no files are needed, still include <explanation> and <tests>.`;
}

async function callGrokCollect(model: 'grok-4' | 'grok-code-fast-1', prompt: string): Promise<string> {
	let text = '';
	for await (const chunk of callGrok(model, prompt)) {
		if (chunk.type === 'text' && chunk.text) {
			text += chunk.text;
		}
	}
	return text;
}

async function callClaudeCollect(modelName: string, system: string, user: string): Promise<string> {
	const anthropic = createAnthropic({
		apiKey: process.env.AI_GATEWAY_API_KEY ?? process.env.ANTHROPIC_API_KEY,
		baseURL: process.env.AI_GATEWAY_API_KEY ? 'https://ai-gateway.vercel.sh/v1' : (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1'),
	});
	const result = await generateText({
		model: anthropic(modelName),
		messages: [
			{ role: 'system', content: system },
			{ role: 'user', content: user }
		],
		maxOutputTokens: 8192,
		temperature: 0.3
	});
	return result.text || '';
}

type FileOut = { path: string; content: string; diff: boolean; modelUsed: 'grok' | 'claude' };

function parseOutputToJson(raw: string, modelUsed: 'grok' | 'claude'): { files: FileOut[]; explanation: string; tests: string } {
	const files: FileOut[] = [];

	// Extract <file> blocks
	const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
	let m: RegExpExecArray | null;
	while ((m = fileRegex.exec(raw)) !== null) {
		const path = m[1];
		const content = m[2].trim();
		files.push({ path, content, diff: false, modelUsed });
	}

	// If no files found but content exists, place as a single file
	if (files.length === 0 && raw.trim().length > 0) {
		files.push({
			path: 'src/App.jsx',
			content: raw.trim(),
			diff: false,
			modelUsed
		});
	}

	// Explanation and tests
	const explanation = (raw.match(/<explanation>([\s\S]*?)<\/explanation>/)?.[1] || '').trim();
	const tests = (raw.match(/<tests>([\s\S]*?)<\/tests>/)?.[1] || '').trim();

	return { files, explanation, tests };
}

async function maybeScrape(url?: string): Promise<string | undefined> {
	if (!url) return undefined;
	try {
		// Prefer enhanced scraper if present
		const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
		const res = await fetch(`${base}/api/scrape-url-enhanced`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url })
		});
		if (res.ok) {
			const data = await res.json();
			// Try to pull best text content field
			return typeof data?.content === 'string'
				? data.content
				: JSON.stringify(data).substring(0, 16000);
		}
	} catch {
		// Fall through silently
	}
	return undefined;
}

function unifiedDiff(oldText: string, newText: string): string {
	const oldLines = oldText.split('\n');
	const newLines = newText.split('\n');
	// Simple LCS-based diff to produce unified-like output
	const m = oldLines.length, n = newLines.length;
	const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
	for (let i = m - 1; i >= 0; i--) {
		for (let j = n - 1; j >= 0; j--) {
			if (oldLines[i] === newLines[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
			else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
		}
	}
	let i = 0, j = 0;
	const out: string[] = [];
	while (i < m && j < n) {
		if (oldLines[i] === newLines[j]) {
			out.push(' ' + oldLines[i]);
			i++; j++;
		} else if (dp[i + 1][j] >= dp[i][j + 1]) {
			out.push('-' + oldLines[i]);
			i++;
		} else {
			out.push('+' + newLines[j]);
			j++;
		}
	}
	while (i < m) { out.push('-' + oldLines[i]); i++; }
	while (j < n) { out.push('+' + newLines[j]); j++; }
	return out.join('\n');
}

export async function POST(request: NextRequest) {
	try {
		const { prompt, vibe, mode, scrape, context, baseFiles, testsSpec } = await request.json();
		if (!prompt || typeof prompt !== 'string') {
			return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
		}

		// Optional Firecrawl scrape flow
		let scraped: string | undefined;
		if (scrape?.url && typeof scrape.url === 'string') {
			scraped = await maybeScrape(scrape.url);
		} else if (context?.scraped && typeof context.scraped === 'string') {
			scraped = context.scraped;
		}

		const route = decideRoute(prompt, vibe as Vibe, mode);

		const system = buildSystemPrompt({ scraped });
		const user = `USER REQUEST:\n${prompt}\n\nPlease output <file>, <explanation>, and <tests> tags as specified.\n${
			testsSpec ? `\nTESTS SPEC:\nGenerate a Vitest/Jest suite covering: ${testsSpec}` : 'Include a meaningful Vitest/Jest suite that validates the behavior.'}`;

		let grokText = '';
		let finalText = '';
		let files: FileOut[] = [];
		let explanation = '';
		let tests = '';

		if (route === 'grok') {
			const grokPrompt = `SYSTEM:\n${system}\n\n${user}`;
			grokText = await callGrokCollect('grok-4', grokPrompt);
			const parsed = parseOutputToJson(grokText, 'grok');
			files = parsed.files;
			explanation = parsed.explanation;
			tests = parsed.tests;
		} else if (route === 'claude') {
			const modelName = process.env.ANTHROPIC_SONNET_MODEL || 'claude-3-5-sonnet-20241022';
			finalText = await callClaudeCollect(modelName, system, user);
			const parsed = parseOutputToJson(finalText, 'claude');
			files = parsed.files;
			explanation = parsed.explanation;
			tests = parsed.tests;
		} else {
			// dual mode
			const grokPrompt = `SYSTEM:\n${system}\n\n${user}`;
			grokText = await callGrokCollect('grok-4', grokPrompt);
			// Chain to Claude with Grok output as context
			const modelName = process.env.ANTHROPIC_SONNET_MODEL || 'claude-3-5-sonnet-20241022';
			const claudeSystem = buildSystemPrompt({ scraped });
			const claudeUser = `The following is an initial scaffold produced by another model (Grok). Refine, harden, and correct any issues, then output final <file>, <explanation>, and <tests> tags.\n\nINITIAL SCAFFOLD:\n${grokText}\n\nORIGINAL REQUEST:\n${prompt}`;
			finalText = await callClaudeCollect(modelName, claudeSystem, claudeUser);
			// Prefer Claude's parsed output; if it produced nothing, fall back to Grok
			const parsedClaude = parseOutputToJson(finalText, 'claude');
			if (parsedClaude.files.length > 0) {
				files = parsedClaude.files;
				explanation = parsedClaude.explanation;
				tests = parsedClaude.tests;
			} else {
				const parsedGrok = parseOutputToJson(grokText, 'grok');
				files = parsedGrok.files;
				explanation = parsedGrok.explanation;
				tests = parsedGrok.tests;
			}
		}

		// Compute diffs if caller provided base files
		if (baseFiles && typeof baseFiles === 'object') {
			files = files.map(f => {
				const before = typeof baseFiles[f.path] === 'string' ? baseFiles[f.path] : '';
				const after = f.content || '';
				const differs = before !== after;
				return {
					...f,
					diff: differs
				};
			});
		}

		return NextResponse.json({
			files,
			explanation,
			tests
		});
	} catch (error: any) {
		console.error('[api/gen] Error:', error);
		return NextResponse.json(
			{ error: error?.message || 'Internal Server Error' },
			{ status: 500 }
		);
	}
}


