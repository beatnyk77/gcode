import { NextRequest, NextResponse } from 'next/server';

// Uses existing run-command API which executes in the active sandbox

export async function POST(request: NextRequest) {
	try {
		const { runner } = await request.json();
		const command = runner === 'jest'
			? 'npx jest --json --outputFile=/tmp/jest-results.json'
			: 'npx vitest run --reporter=json';

		const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
		const res = await fetch(`${base}/api/run-command`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ command })
		});

		if (!res.ok) {
			const data = await res.json().catch(() => ({} as any));
			return NextResponse.json({ success: false, error: data?.error || 'Failed to execute tests' }, { status: 500 });
		}

		const data = await res.json();
		const output: string = data.output || '';

		// Try to parse vitest JSON reporter from stdout
		let passRate = 0;
		let passed = 0;
		let failed = 0;
		let total = 0;

		try {
			// Vitest JSON reporter prints a JSON object; find last JSON block
			const jsonMatch = output.match(/\{[\s\S]*\}$/m);
			if (jsonMatch) {
				const parsed = JSON.parse(jsonMatch[0]);
				const stats = parsed?.stats || parsed;
				if (stats) {
					passed = Number(stats.passed) || 0;
					failed = Number(stats.failed) || 0;
					total = Number(stats.testCount || (passed + failed + (Number(stats.skipped) || 0))) || 0;
				}
			}
		} catch {
			// ignore parse errors, fallback to heuristic
		}

		if (total === 0) {
			// Heuristic fallback: parse lines like "Tests: 12 passed, 3 failed, 20 total"
			const m = output.match(/Tests:\s+(?:(\d+)\s+passed,)?\s*(?:(\d+)\s+failed,)?\s*(\d+)\s+total/i);
			if (m) {
				passed = Number(m[1] || 0);
				failed = Number(m[2] || 0);
				total = Number(m[3] || 0);
			}
		}

		if (total > 0) {
			passRate = passed / total;
		}

		return NextResponse.json({
			success: true,
			passRate,
			passed,
			failed,
			total,
			output,
			exitCode: data.exitCode
		});
	} catch (error: any) {
		console.error('[run-tests] Error:', error);
		return NextResponse.json({ success: false, error: error?.message || 'Internal Error' }, { status: 500 });
	}
}


