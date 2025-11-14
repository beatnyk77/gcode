import { create } from 'zustand';

type FilesState = {
	files: Record<string, string>;
	userEdits: Set<string>;
	openTabs: string[];
	activePath?: string;
	stagedChanges: Array<{ path: string; before: string; after: string; modelUsed?: 'grok' | 'claude' }>;
	setFiles: (files: Record<string, string>) => void;
	updateFile: (path: string, content: string) => void;
	openTab: (path: string) => void;
	closeTab: (path: string) => void;
	setActive: (path?: string) => void;
	renamePath: (from: string, to: string) => void;
	reorderTabs: (paths: string[]) => void;
	setStagedChanges: (changes: Array<{ path: string; before: string; after: string; modelUsed?: 'grok' | 'claude' }>) => void;
	clearStagedChanges: () => void;
	applyStagedChanges: () => { applied: number; skipped: number };
};

export const useFilesStore = create<FilesState>((set, get) => ({
	files: {},
	userEdits: new Set<string>(),
	openTabs: [],
	activePath: undefined,
	stagedChanges: [],
	setFiles: (files) => {
		const first = Object.keys(files)[0];
		set({ files, openTabs: first ? [first] : [], activePath: first });
	},
	updateFile: (path, content) => {
		const next = { ...get().files, [path]: content };
		const edits = new Set(get().userEdits);
		edits.add(path);
		set({ files: next, userEdits: edits });
	},
	openTab: (path) => {
		const tabs = get().openTabs;
		if (!tabs.includes(path)) {
			set({ openTabs: [...tabs, path], activePath: path });
		} else {
			set({ activePath: path });
		}
	},
	closeTab: (path) => {
		const tabs = get().openTabs.filter(p => p !== path);
		const active = get().activePath;
		let nextActive = active;
		if (active === path) {
			nextActive = tabs[tabs.length - 1];
		}
		set({ openTabs: tabs, activePath: nextActive });
	},
	setActive: (path) => set({ activePath: path }),
	renamePath: (from, to) => {
		const files = { ...get().files };
		if (files[from] !== undefined) {
			files[to] = files[from];
			delete files[from];
		}
		const tabs = get().openTabs.map(p => (p === from ? to : p));
		const edits = new Set(Array.from(get().userEdits).map(p => (p === from ? to : p)));
		const active = get().activePath === from ? to : get().activePath;
		set({ files, openTabs: tabs, userEdits: edits, activePath: active });
	},
	reorderTabs: (paths) => set({ openTabs: paths }),
	setStagedChanges: (changes) => set({ stagedChanges: changes }),
	clearStagedChanges: () => set({ stagedChanges: [] }),
	applyStagedChanges: () => {
		const { stagedChanges, files, userEdits } = get();
		let applied = 0, skipped = 0;
		const nextFiles = { ...files };
		const edits = new Set(userEdits);
		for (const change of stagedChanges) {
			if (edits.has(change.path)) {
				skipped++;
				continue;
			}
			nextFiles[change.path] = change.after;
			// ensure it's not marked as userEdit after apply
			if (edits.has(change.path)) edits.delete(change.path);
			applied++;
		}
		set({ files: nextFiles, stagedChanges: [] , userEdits: edits });
		return { applied, skipped };
	}
}));


