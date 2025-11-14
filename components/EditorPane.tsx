'use client';

import React from 'react';
import Editor from '@monaco-editor/react';
import { useFilesStore } from '@/lib/store/files';
import { useUIStore } from '@/lib/store/ui';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import HMRErrorDetector from '@/components/HMRErrorDetector';
import * as d3 from 'd3';

function UnifiedDiffView({ before, after }: { before: string; after: string }) {
	// Simple unified diff on client: line-by-line compare
	const beforeLines = before.split('\n');
	const afterLines = after.split('\n');
	// naive pass: show lines unique to before as - and to after as +
	// For better UX, show both sequences with markers; not LCS, but conveys changes
	const maxLen = Math.max(beforeLines.length, afterLines.length);
	const rows = [];
	for (let i = 0; i < maxLen; i++) {
		const b = beforeLines[i];
		const a = afterLines[i];
		if (b === a) {
			if (typeof a === 'string') rows.push({ type: 'same' as const, text: a });
		} else {
			if (typeof b === 'string') rows.push({ type: 'remove' as const, text: b });
			if (typeof a === 'string') rows.push({ type: 'add' as const, text: a });
		}
	}
	return (
		<div className="rounded border border-gray-200 overflow-hidden">
			<pre className="text-xs leading-relaxed">
				{rows.map((r, idx) => (
					<div
						key={idx}
						className={
							r.type === 'add'
								? 'bg-green-50 text-green-900'
								: r.type === 'remove'
								? 'bg-red-50 text-red-900'
								: 'bg-white text-gray-800'
						}
					>
						{r.type === 'add' ? '+ ' : r.type === 'remove' ? '- ' : '  '}
						{r.text}
					</div>
				))}
			</pre>
		</div>
	);
}

function extToLanguage(path?: string): string | undefined {
	if (!path) return undefined;
	if (path.endsWith('.ts')) return 'typescript';
	if (path.endsWith('.tsx')) return 'typescript';
	if (path.endsWith('.js')) return 'javascript';
	if (path.endsWith('.jsx')) return 'javascript';
	if (path.endsWith('.css')) return 'css';
	if (path.endsWith('.json')) return 'json';
	if (path.endsWith('.md')) return 'markdown';
	if (path.endsWith('.html')) return 'html';
	return undefined;
}

function SortableTab({ id, label, onClose, isActive, onClick }: { id: string; label: string; onClose: () => void; isActive: boolean; onClick: () => void; }) {
	const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
	const style: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition
	};
	return (
		<div
			ref={setNodeRef}
			style={style}
			className={`flex items-center gap-2 px-3 py-1 rounded-t-md border border-b-0 ${isActive ? 'bg-white text-gray-900 border-gray-300' : 'bg-gray-100 text-gray-700 border-gray-200'} cursor-pointer`}
			onClick={onClick}
			{...attributes}
			{...listeners}
		>
			<span className="truncate max-w-[16rem] text-sm">{label}</span>
			<button className="text-xs text-gray-500 hover:text-gray-900" onClick={(e) => { e.stopPropagation(); onClose(); }}>×</button>
		</div>
	);
}

function IntegrationPromptForm({ onSubmit, loading, error }: { onSubmit: (prompt: string) => void; loading: boolean; error: string | null }) {
	const [prompt, setPrompt] = React.useState('');
	const [service, setService] = React.useState('');
	
	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const finalPrompt = service ? `Integrate ${service}: ${prompt}` : prompt;
		if (finalPrompt.trim()) {
			onSubmit(finalPrompt);
		}
	};
	
	return (
		<form onSubmit={handleSubmit} className="space-y-3">
			<div>
				<label className="block text-xs font-medium text-gray-700 mb-1">Service (optional)</label>
				<input
					type="text"
					value={service}
					onChange={(e) => setService(e.target.value)}
					placeholder="e.g., Stripe, Auth0, Firebase"
					className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
				/>
			</div>
			<div>
				<label className="block text-xs font-medium text-gray-700 mb-1">Integration Request</label>
				<textarea
					value={prompt}
					onChange={(e) => setPrompt(e.target.value)}
					placeholder="e.g., add Stripe payments with checkout flow, or paste a Figma design URL"
					rows={4}
					className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
				/>
			</div>
			{error && (
				<div className="text-xs text-red-700 bg-red-50 rounded px-2 py-1">
					{error}
				</div>
			)}
			<div className="flex items-center justify-end gap-2">
				<button
					type="submit"
					disabled={loading || !prompt.trim()}
					className="px-4 py-2 text-sm rounded-md bg-purple-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-700"
				>
					{loading ? 'Integrating…' : 'Integrate'}
				</button>
			</div>
		</form>
	);
}

function FileTree() {
	const { files, openTab } = useFilesStore(s => ({ files: s.files, openTab: s.openTab }));
	const paths = Object.keys(files).sort();
	return (
		<div className="h-full overflow-auto px-2 py-2">
			{paths.length === 0 && (
				<div className="text-xs text-gray-500 px-2">No files yet. Generate to populate.</div>
			)}
			<ul className="space-y-1">
				{paths.map(p => (
					<li key={p}>
						<button
							className="w-full text-left text-sm text-gray-800 hover:bg-gray-100 rounded px-2 py-1"
							onClick={() => openTab(p)}
							title={p}
						>
							{p}
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}

export default function EditorPane() {
	const {
		files, activePath, openTabs,
		updateFile, closeTab, setActive, reorderTabs,
		stagedChanges, clearStagedChanges, applyStagedChanges, userEdits
	} = useFilesStore(s => ({
		files: s.files,
		activePath: s.activePath,
		openTabs: s.openTabs,
		updateFile: s.updateFile,
		closeTab: s.closeTab,
		setActive: s.setActive,
		reorderTabs: s.reorderTabs,
		stagedChanges: s.stagedChanges,
		clearStagedChanges: s.clearStagedChanges,
		applyStagedChanges: s.applyStagedChanges,
		userEdits: s.userEdits
	}));

	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

	const onDragEnd = (event: any) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;
		const oldIndex = openTabs.indexOf(active.id);
		const newIndex = openTabs.indexOf(over.id);
		reorderTabs(arrayMove(openTabs, oldIndex, newIndex));
	};

	const code = activePath ? files[activePath] : '';
	const language = extToLanguage(activePath);
	const [isTesting, setIsTesting] = React.useState(false);
	const [testResult, setTestResult] = React.useState<{ passRate: number; passed: number; failed: number; total: number; output: string } | null>(null);
	const [testError, setTestError] = React.useState<string | null>(null);
	const selectedVibe = useUIStore(s => s.selectedVibe);
	const setStagedChanges = useFilesStore(s => s.setStagedChanges);
	const [hardening, setHardening] = React.useState(false);
	const [hardenError, setHardenError] = React.useState<string | null>(null);
	const [integrating, setIntegrating] = React.useState(false);
	const [integrateError, setIntegrateError] = React.useState<string | null>(null);
	const [integrateModal, setIntegrateModal] = React.useState<{ open: boolean; service?: string }>({ open: false });
	const iframeRef = React.useRef<HTMLIFrameElement>(null);
	const [debugModal, setDebugModal] = React.useState<{ open: boolean; explanation?: string; fixes?: Array<{ title: string; tradeoffs: string; diffs: Array<{ path: string; unified: string }> }> }>(
		{ open: false }
	);
	const graphRef = React.useRef<SVGSVGElement>(null);

	async function runTests() {
		try {
			setIsTesting(true);
			setTestError(null);
			setTestResult(null);
			const res = await fetch('/api/run-tests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ runner: 'vitest' })
			});
			const data = await res.json();
			if (!res.ok || !data.success) {
				throw new Error(data?.error || 'Failed to run tests');
			}
			setTestResult({
				passRate: data.passRate ?? 0,
				passed: data.passed ?? 0,
				failed: data.failed ?? 0,
				total: data.total ?? 0,
				output: data.output ?? ''
			});
		} catch (e: any) {
			setTestError(e?.message || 'Unknown error');
		} finally {
			setIsTesting(false);
		}
	}

	// Dependency graph build from import statements
	React.useEffect(() => {
		if (!debugModal.open || !graphRef.current) return;
		const nodes: Array<{ id: string; type: 'file' | 'pkg' }> = [];
		const edges: Array<{ source: string; target: string }> = [];
		const nodeSet = new Set<string>();
		const addNode = (id: string, type: 'file'|'pkg') => { if (!nodeSet.has(id)) { nodeSet.add(id); nodes.push({ id, type }); } };
		for (const [path, content] of Object.entries(files)) {
			addNode(path, 'file');
			if (typeof content === 'string') {
				const importRegex = /from\s+['"]([^'"]+)['"]/g;
				let m: RegExpExecArray | null;
				while ((m = importRegex.exec(content)) !== null) {
					const imp = m[1];
					if (!imp.startsWith('.') && !imp.startsWith('/')) {
						const pkg = imp.startsWith('@') ? imp.split('/').slice(0,2).join('/') : imp.split('/')[0];
						addNode(pkg, 'pkg');
						edges.push({ source: path, target: pkg });
					}
				}
			}
		}
		const width = 540, height = 320;
		const svg = d3.select(graphRef.current);
		svg.selectAll('*').remove();
		const sim = d3.forceSimulation(nodes as any)
			.force('link', d3.forceLink(edges as any).id((d: any) => d.id).distance(80))
			.force('charge', d3.forceManyBody().strength(-120))
			.force('center', d3.forceCenter(width/2, height/2));
		const link = svg.append('g').attr('stroke', '#ddd').selectAll('line').data(edges).enter().append('line');
		const node = svg.append('g').selectAll('circle').data(nodes).enter().append('circle')
			.attr('r', d => d.type === 'file' ? 6 : 8)
			.attr('fill', d => d.type === 'file' ? '#4f46e5' : '#10b981')
			.call(d3.drag<any, any>()
				.on('start', (event, d) => { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
				.on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
				.on('end', (event, d) => { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
			);
		const labels = svg.append('g').selectAll('text').data(nodes).enter().append('text')
			.text(d => d.id.split('/').pop() || d.id).attr('font-size', 9).attr('fill', '#374151');
		(sim as any).on('tick', () => {
			link.attr('x1', (d: any) => (d.source as any).x).attr('y1', (d: any) => (d.source as any).y)
				.attr('x2', (d: any) => (d.target as any).x).attr('y2', (d: any) => (d.target as any).y);
			node.attr('cx', (d: any) => d.x).attr('cy', (d: any) => d.y);
			labels.attr('x', (d: any) => d.x + 10).attr('y', (d: any) => d.y + 3);
		});
		return () => { (sim as any).stop(); };
	}, [debugModal.open, files]);

	// Simple unified diff applier (client)
	function applyUnifiedDiffClient(before: string, unified: string): string {
		const lines = unified.split('\n').filter(l => !l.startsWith('--- ') && !l.startsWith('+++ ') && !l.startsWith('@@'));
		const beforeLines = before.split('\n');
		const out: string[] = [];
		let i = 0;
		for (const l of lines) {
			if (l.startsWith(' ')) {
				const expect = l.slice(1);
				if (beforeLines[i] === expect) { out.push(expect); i++; } else { return before; }
			} else if (l.startsWith('-')) {
				const rem = l.slice(1);
				if (beforeLines[i] === rem) { i++; }
			} else if (l.startsWith('+')) {
				out.push(l.slice(1));
			}
		}
		while (i < beforeLines.length) out.push(beforeLines[i++]);
		return out.join('\n');
	}

	async function handleErrorDetected(errors: Array<{ type: string; message: string; package?: string; stack?: string }>) {
		try {
			const stack = errors.map(e => `${e.type}: ${e.message}\n${e.stack || ''}`).join('\n\n');
			const res = await fetch('/api/debug', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ stack, files, vibe: selectedVibe })
			});
			const data = await res.json();
			if (res.ok && data.success) {
				setDebugModal({ open: true, explanation: data.explanation, fixes: data.fixes || [] });
			}
		} catch (e) {
			// ignore
		}
	}

	async function handleIntegrate(prompt: string) {
		try {
			setIntegrating(true);
			setIntegrateError(null);
			const res = await fetch('/api/integrate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt, files })
			});
			const data = await res.json();
			if (!res.ok || !data.success) {
				throw new Error(data?.error || 'Integration failed');
			}
			// Stage the generated files
			if (data.files && Array.isArray(data.files)) {
				const staged = data.files
					.filter((f: any) => f.path !== 'INTEGRATION_INFO.md')
					.map((f: any) => ({
						path: f.path,
						before: typeof files[f.path] === 'string' ? files[f.path] : '',
						after: f.content,
						modelUsed: 'grok' as const
					}));
				if (staged.length > 0) {
					setStagedChanges(staged);
				}
			}
			setIntegrateModal({ open: false });
		} catch (e: any) {
			setIntegrateError(e?.message || 'Unknown error');
		} finally {
			setIntegrating(false);
		}
	}

	return (
		<div className="w-full h-full grid grid-cols-1 lg:grid-cols-4 gap-0">
			{/* Integration Modal */}
			{integrateModal.open && (
				<div className="fixed inset-0 z-50 flex items-center justify-center">
					<div className="absolute inset-0 bg-black/30" onClick={() => setIntegrateModal({ open: false })} />
					<div className="relative bg-white rounded-lg shadow-xl w-[90vw] max-w-2xl max-h-[80vh] overflow-hidden">
						<div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
							<div className="text-sm font-semibold text-gray-900">Integrate Service</div>
							<button className="text-xs text-gray-700 border border-gray-200 rounded px-2 py-1" onClick={() => setIntegrateModal({ open: false })}>Close</button>
						</div>
						<div className="p-4 space-y-4">
							<div className="text-xs text-gray-600">
								Enter a service to integrate (e.g., "add Stripe payments", "integrate Auth0", "add Firebase auth").
								You can also paste a Figma design URL to convert it to JSX.
							</div>
							<IntegrationPromptForm
								onSubmit={handleIntegrate}
								loading={integrating}
								error={integrateError}
							/>
						</div>
					</div>
				</div>
			)}
			{/* AI Debug Modal */}
			{debugModal.open && (
				<div className="fixed inset-0 z-40 flex items-center justify-center">
					<div className="absolute inset-0 bg-black/30" onClick={() => setDebugModal({ open: false })} />
					<div className="relative bg-white rounded-lg shadow-xl w-[95vw] max-w-6xl max-h-[85vh] overflow-hidden">
						<div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
							<div className="text-sm font-semibold text-gray-900">AI Debugging Suggestions</div>
							<button className="text-xs text-gray-700 border border-gray-200 rounded px-2 py-1" onClick={() => setDebugModal({ open: false })}>Close</button>
						</div>
						<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
							<div className="lg:col-span-2 space-y-3 overflow-auto">
								{debugModal.explanation && (
									<div className="border border-gray-200 rounded p-3">
										<div className="text-xs font-medium text-gray-900 mb-1">Explanation</div>
										<div className="text-xs text-gray-800 whitespace-pre-wrap">{debugModal.explanation}</div>
									</div>
								)}
								<div className="space-y-3">
									{(debugModal.fixes || []).map((f, idx) => (
										<div key={idx} className="border border-gray-200 rounded p-3">
											<div className="flex items-center justify-between mb-1">
												<div className="text-xs font-medium text-gray-900">{f.title}</div>
												<button
													className="text-xs bg-gray-900 text-white rounded px-2 py-1"
													onClick={() => {
														const staged = (f.diffs || []).map(d => {
															const before = typeof files[d.path] === 'string' ? files[d.path] : '';
															const after = applyUnifiedDiffClient(before, d.unified);
															return { path: d.path, before, after, modelUsed: 'grok' as const };
														});
														if (staged.length > 0) {
															setStagedChanges(staged);
															setDebugModal({ open: false });
														}
													}}
												>
													Apply Fix
												</button>
											</div>
											<div className="text-[11px] text-gray-700 whitespace-pre-wrap mb-2">{f.tradeoffs}</div>
											{f.diffs?.length ? (
												<details className="text-[11px]">
													<summary className="cursor-pointer text-gray-700">Show diffs</summary>
													{f.diffs.map((d, i2) => (
														<div key={i2} className="mt-1 border border-gray-200 rounded p-2">
															<div className="font-medium text-gray-900 mb-1">{d.path}</div>
															<pre className="overflow-auto bg-gray-50 p-2">{d.unified}</pre>
														</div>
													))}
												</details>
											) : null}
										</div>
									))}
								</div>
							</div>
							<div className="lg:col-span-1">
								<div className="text-xs font-medium text-gray-900 mb-2">Dependency Graph</div>
								<svg ref={graphRef} width="540" height="320" />
								<div className="text-[11px] text-gray-500 mt-2">Files (purple) → Packages (green)</div>
							</div>
						</div>
					</div>
				</div>
			)}
			{/* Diff Modal */}
			{stagedChanges.length > 0 && (
				<div className="fixed inset-0 z-50 flex items-center justify-center">
					<div className="absolute inset-0 bg-black/30" onClick={clearStagedChanges} />
					<div className="relative bg-white rounded-lg shadow-xl w-[95vw] max-w-6xl max-h-[85vh] overflow-hidden">
						<div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
							<div className="text-sm font-semibold text-gray-900">Proposed changes</div>
							<div className="flex items-center gap-2">
								<button
									onClick={runTests}
									disabled={isTesting}
									className="text-sm px-3 py-1 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
								>
									{isTesting ? 'Running Tests...' : 'Run Tests'}
								</button>
								<button
									onClick={clearStagedChanges}
									className="text-sm px-3 py-1 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
								>
									Cancel
								</button>
								<button
									onClick={() => {
										if (testResult && testResult.passRate >= 0.8) {
											applyStagedChanges();
											clearStagedChanges();
										}
									}}
									disabled={!testResult || testResult.passRate < 0.8}
									title={!testResult ? 'Run tests first' : (testResult.passRate < 0.8 ? 'Requires >= 80% pass' : 'Apply')}
									className="text-sm px-3 py-1 rounded-md bg-gray-900 text-white disabled:opacity-50"
								>
									Apply to Files
								</button>
							</div>
						</div>
						<div className="overflow-auto p-4 space-y-4">
							{stagedChanges.map((c) => {
								const isEdited = userEdits.has(c.path);
								return (
									<div key={c.path} className="border border-gray-200 rounded-md">
										<div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between bg-gray-50">
											<div className="text-sm font-medium text-gray-900">{c.path}</div>
											{isEdited && <div className="text-xs text-orange-700 bg-orange-100 px-2 py-0.5 rounded">Skipped: local edits present</div>}
										</div>
										<div className="p-3">
											<UnifiedDiffView before={c.before} after={c.after} />
										</div>
									</div>
								);
							})}
							<div className="border border-gray-200 rounded-md">
								<div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
									<div className="text-sm font-medium text-gray-900">Test Results</div>
									{testResult && (
										<div className={`text-xs px-2 py-0.5 rounded ${testResult.passRate >= 0.8 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
											{Math.round((testResult.passRate || 0) * 100)}% pass
										</div>
									)}
								</div>
								<div className="p-3">
									{testError && <div className="text-sm text-red-700 bg-red-50 rounded px-2 py-1">{testError}</div>}
									{testResult && (
										<div className="text-xs text-gray-800">
											<div className="mb-2">Passed: {testResult.passed} • Failed: {testResult.failed} • Total: {testResult.total}</div>
											<pre className="bg-gray-900 text-gray-100 p-2 rounded overflow-auto max-h-64">{testResult.output}</pre>
										</div>
									)}
									{!testResult && !testError && (
										<div className="text-xs text-gray-500">Run tests to view results here.</div>
									)}
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
			<aside className="lg:col-span-1 border-r border-gray-200 bg-white min-h-[60vh]">
				<div className="px-3 py-2 border-b border-gray-200 text-sm font-medium text-gray-700">
					Files
				</div>
				<FileTree />
			</aside>
			<main className="lg:col-span-3 flex flex-col min-h-[60vh]">
				<div className="bg-gray-100 border-b border-gray-200">
					<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
						<SortableContext items={openTabs} strategy={horizontalListSortingStrategy}>
							<div className="flex items-end gap-1 px-2 pt-2">
								{openTabs.map(path => (
									<SortableTab
										key={path}
										id={path}
										label={path.split('/').pop() || path}
										onClose={() => closeTab(path)}
										isActive={activePath === path}
										onClick={() => setActive(path)}
									/>
								))}
								<div className="ml-auto flex items-center gap-2 pb-1">
									<button
										onClick={() => setIntegrateModal({ open: true })}
										className="px-3 py-1.5 text-xs rounded-md bg-purple-600 text-white hover:bg-purple-700"
										title="Integrate third-party services (Stripe, Auth0, Firebase, etc.)"
										aria-label="Integrate third-party services"
									>
										Integrate Service
									</button>
									<button
										onClick={async () => {
											try {
												setHardening(true);
												setHardenError(null);
												const res = await fetch('/api/harden', {
													method: 'POST',
													headers: { 'Content-Type': 'application/json' },
													body: JSON.stringify({ files, vibe: selectedVibe })
												});
												const data = await res.json();
												if (!res.ok || !data.success) {
													throw new Error(data?.error || 'Hardening failed');
												}
												const changes = (data.files as Array<{ path: string; content: string }>) || [];
												if (changes.length > 0) {
													const staged = changes.map(c => ({
														path: c.path,
														before: typeof files[c.path] === 'string' ? files[c.path] : '',
														after: c.content,
														modelUsed: 'claude' as const
													}));
													setStagedChanges(staged);
												}
											} catch (e: any) {
												setHardenError(e?.message || 'Unknown error');
											} finally {
												setHardening(false);
											}
										}}
										className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white disabled:opacity-50"
										disabled={hardening}
										title="Audit and harden for production; outputs diffs"
										aria-label={hardening ? 'Hardening code for production' : 'Harden code to production'}
										aria-busy={hardening}
									>
										{hardening ? 'Hardening…' : 'Harden to Prod'}
									</button>
								</div>
							</div>
						</SortableContext>
					</DndContext>
				</div>
				{hardenError && (
					<div className="px-3 py-2 text-xs text-red-700 bg-red-50 border-b border-red-200">
						{hardenError}
					</div>
				)}
				{integrateError && (
					<div className="px-3 py-2 text-xs text-red-700 bg-red-50 border-b border-red-200">
						Integration error: {integrateError}
					</div>
				)}
				<div className="flex-1 grid grid-rows-2">
					<div className="row-span-1 min-h-[300px]">
						{activePath ? (
							<Editor
								height="100%"
								defaultLanguage={language}
								language={language}
								value={code}
								path={activePath}
								theme="vs-dark"
								onChange={(val) => updateFile(activePath, val ?? '')}
								options={{
									minimap: { enabled: false },
									fontSize: 13,
									scrollBeyondLastLine: false,
									wordWrap: 'on'
								}}
							/>
						) : (
							<div className="h-full flex items-center justify-center text-sm text-gray-500">
								Open a file to start editing
							</div>
						)}
					</div>
					<div className="row-span-1 border-t border-gray-200 bg-white">
						<div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
							<div className="text-sm font-medium text-gray-700">Live Preview</div>
							<div className="text-xs text-gray-500">Connected to running app (local or Vercel preview)</div>
						</div>
						<iframe
							title="Live Preview"
							className="w-full h-full"
							src={process.env.NEXT_PUBLIC_PREVIEW_URL || 'http://localhost:5173'}
						/>
					</div>
				</div>
			</main>
		</div>
	);
}


