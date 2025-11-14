import { NextRequest, NextResponse } from 'next/server';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

function parseUnifiedDiff(diffText: string): string[] {
	// Return array of operations lines, filtering headers
	return diffText
		.split('\n')
		.filter(line => !line.startsWith('--- ') && !line.startsWith('+++ ') && !line.startsWith('@@'));
}

function applyUnifiedDiff(before: string, diffText: string): string {
	// Naive line-based diff application: interprets lines starting with ' ', '+', '-'
	const operations = parseUnifiedDiff(diffText);
	const beforeLines = before.split('\n');
	const result: string[] = [];
	let i = 0;
	for (const op of operations) {
		if (op.startsWith(' ')) {
			// Context line: must match current before line; if mismatch, fallback to passthrough
			const expected = op.slice(1);
			if (beforeLines[i] === expected) {
				result.push(expected);
				i++;
			} else {
				// Fallback: return original before if patch doesn't align
				return before;
			}
		} else if (op.startsWith('-')) {
			// Deletion: skip a line from before if matches; tolerate if not present
			const toRemove = op.slice(1);
			if (beforeLines[i] === toRemove) {
				i++;
			} // else mismatch; continue without advancing
		} else if (op.startsWith('+')) {
			// Addition: add new line
			result.push(op.slice(1));
		} else {
			// Unknown marker: copy through as safety
			result.push(op);
		}
	}
	// Append any remaining original lines not touched
	while (i < beforeLines.length) {
		result.push(beforeLines[i++]);
	}
	return result.join('\n');
}

export async function POST(request: NextRequest) {
	try {
		const { files, vibe } = await request.json();
		if (!files || typeof files !== 'object') {
			return NextResponse.json({ error: 'files object required' }, { status: 400 });
		}

		const anthropic = createAnthropic({
			apiKey: process.env.AI_GATEWAY_API_KEY ?? process.env.ANTHROPIC_API_KEY,
			baseURL: process.env.AI_GATEWAY_API_KEY ? 'https://ai-gateway.vercel.sh/v1' : (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1'),
		});
		const modelName = process.env.ANTHROPIC_SONNET_MODEL || 'claude-3-5-sonnet-20241022';

		const vibeRules = vibe === 'enterprise'
			? 'Enforce enterprise guardrails: security first, full documentation blocks, tests, feature flags.'
			: vibe === 'scrappy'
			? 'Allow minimal scaffolds but ensure critical prod hooks exist; keep changes focused.'
			: vibe === 'a11y'
			? 'Ensure accessibility best practices across changes, add notes on WCAG coverage.'
			: 'Apply reasonable production hardening.';

		const system = `You are a senior platform engineer performing production hardening on a JavaScript/TypeScript web app.
Audit for production readiness and propose minimal, targeted diffs only.
Add:
- Sentry logging hooks
- Snyk scan stubs (scripts/placeholders)
- Performance budgets (Lighthouse/CI thresholds)
- Feature flags (LaunchDarkly placeholders)
- GitHub Actions YAML for CI/CD (build/test/lint & perf checks)
Output only unified diffs, one per file, wrapped in <diff path="..."> blocks. Do NOT output full files.
${vibeRules}
Rules:
- Keep diffs minimal and precise
- Include new files as diffs from empty
- Do not include prose outside diff blocks`;

		const filesContext = Object.entries(files as Record<string, string>)
			.map(([path, content]) => `<file path="${path}">\n${content}\n</file>`)
			.join('\n');

		const user = `Here are the current files:\n${filesContext}\n\nReturn diffs only.`;

		const result = await generateText({
			model: anthropic(modelName),
			messages: [
				{ role: 'system', content: system },
				{ role: 'user', content: user }
			],
			maxOutputTokens: 8192,
			temperature: 0.3
		});

		const text = result.text || '';
		const diffRegex = /<diff path="([^"]+)">([\s\S]*?)<\/diff>/g;
		const changes: Array<{ path: string; before: string; after: string }> = [];
		let m: RegExpExecArray | null;
		while ((m = diffRegex.exec(text)) !== null) {
			const path = m[1];
			const diffBody = m[2].trim();
			const before = typeof files[path] === 'string' ? (files[path] as string) : '';
			const after = applyUnifiedDiff(before, diffBody);
			if (after !== before) {
				changes.push({ path, before, after });
			}
		}

		return NextResponse.json({
			success: true,
			files: changes.map(c => ({ path: c.path, content: c.after }))
		});
	} catch (error: any) {
		console.error('[harden] Error:', error);
		return NextResponse.json({ error: error?.message || 'Internal Error' }, { status: 500 });
	}
}


