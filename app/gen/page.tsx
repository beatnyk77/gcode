'use client';

import React from 'react';
import { useFilesStore } from '@/lib/store/files';
import { useUIStore } from '@/lib/store/ui';

type ModelOption = 'grok' | 'claude' | 'dual';

type ApiFile = {
	path: string;
	content: string;
	diff: boolean;
	modelUsed: 'grok' | 'claude';
};

export default function GenPage() {
	const [model, setModel] = React.useState<ModelOption>('grok');
	const [prompt, setPrompt] = React.useState('');
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [files, setFiles] = React.useState<ApiFile[]>([]);
	const [explanation, setExplanation] = React.useState('');
	const [tests, setTests] = React.useState('');
	const setStagedChanges = useFilesStore(s => s.setStagedChanges);
	const currentFiles = useFilesStore(s => s.files);
	const selectedVibe = useUIStore(s => s.selectedVibe);

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError(null);
		setFiles([]);
		setExplanation('');
		setTests('');
		try {
			// Map selection to body for server routing
			let finalPrompt = prompt;
			// Append vibe hint if selected
			if (selectedVibe === 'scrappy') {
				finalPrompt += `\n\nGen as Startup Scrappy: prioritize speed and delivery; technical debt acceptable short-term.`;
			} else if (selectedVibe === 'enterprise') {
				finalPrompt += `\n\nGen as Enterprise-Grade: enforce security, feature flags, thorough docs and tests; avoid shortcuts.`;
			} else if (selectedVibe === 'a11y') {
				finalPrompt += `\n\nGen as Accessibility Zen: prioritize WCAG AA/AAA compliance, semantic HTML, aria, keyboard navigation.`;
			}
			const body: any = { prompt: finalPrompt };
			if (model === 'grok') body.vibe = 'scrappy';
			else if (model === 'claude') body.vibe = 'enterprise';
			else if (model === 'dual') body.mode = 'dual';

			const res = await fetch(`/api/gen?model=${encodeURIComponent(model)}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data?.error || `Request failed (${res.status})`);
			}
			const data = await res.json();
			setFiles(Array.isArray(data.files) ? data.files : []);
			setExplanation(typeof data.explanation === 'string' ? data.explanation : '');
			setTests(typeof data.tests === 'string' ? data.tests : '');
			// Stage changes for diff modal
			const staged = (Array.isArray(data.files) ? data.files : []).map((f: any) => ({
				path: f.path,
				before: typeof currentFiles[f.path] === 'string' ? currentFiles[f.path] : '',
				after: f.content || '',
				modelUsed: f.modelUsed
			}));
			if (staged.length > 0) {
				setStagedChanges(staged);
			}
		} catch (err: any) {
			setError(err?.message || 'Something went wrong');
		} finally {
			setLoading(false);
		}
	};

	const ModelBadge: React.FC<{ which: 'grok' | 'claude' }> = ({ which }) => {
		if (which === 'grok') {
			return (
				<span className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-800 text-xs font-medium px-2 py-1">
					<span className="inline-block" aria-hidden>🚀</span>
					Grok
				</span>
			);
		}
		return (
			<span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1">
				<span className="inline-block" aria-hidden>🔨</span>
				Claude
			</span>
		);
	};

	return (
		<div className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto">
			<h1 className="text-2xl font-semibold tracking-tight mb-4">AI Generator</h1>
			<form onSubmit={onSubmit} className="space-y-4">
				<div className="flex flex-col sm:flex-row gap-3">
					<select
						value={model}
						onChange={(e) => setModel(e.target.value as ModelOption)}
						className="w-full sm:w-72 border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
						aria-label="AI model selection"
						id="model-select"
					>
						<option value="grok">Grok - Speed & Creative</option>
						<option value="claude">Claude - Refine & Prod</option>
						<option value="dual">Dual - Smart Route</option>
					</select>
					<input
						value={prompt}
						onChange={(e) => setPrompt(e.target.value)}
						placeholder="Describe what to build or refine..."
						className="flex-1 border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
						aria-label="Prompt input for AI code generation"
						id="prompt-input"
					/>
					<button
						type="submit"
						disabled={loading || !prompt.trim()}
						className="inline-flex items-center justify-center rounded-md bg-gray-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
						aria-label={loading ? 'Generating code' : 'Generate code from prompt'}
						aria-busy={loading}
					>
						{loading ? 'Generating...' : 'Generate'}
					</button>
				</div>
			</form>

			{error && (
				<div className="mt-4 rounded-md border border-red-300 bg-red-50 text-red-800 px-3 py-2">
					{error}
				</div>
			)}

			{(explanation || tests) && (
				<div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
					<div className="rounded-md border border-gray-200 bg-white p-4">
						<h2 className="text-sm font-semibold mb-2">Explanation</h2>
						<pre className="whitespace-pre-wrap text-sm text-gray-800">{explanation}</pre>
					</div>
					<div className="rounded-md border border-gray-200 bg-white p-4">
						<h2 className="text-sm font-semibold mb-2">Tests</h2>
						<pre className="whitespace-pre-wrap text-sm text-gray-800">{tests}</pre>
					</div>
				</div>
			)}

			{files.length > 0 && (
				<div className="mt-6 space-y-4">
					{files.map((f, idx) => (
						<div key={`${f.path}-${idx}`} className="rounded-md border border-gray-200 bg-white">
							<div className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
								<div className="flex items-center gap-2">
									<span className="text-sm font-medium text-gray-900">{f.path}</span>
									<ModelBadge which={f.modelUsed} />
								</div>
								{f.diff ? (
									<span className="text-xs text-gray-600">Diff</span>
								) : (
									<span className="text-xs text-gray-600">Full file</span>
								)}
							</div>
							<pre className="p-4 overflow-auto text-xs leading-relaxed bg-gray-50 text-gray-900">
								<code>{f.content}</code>
							</pre>
						</div>
					))}
				</div>
			)}
		</div>
	);
}


