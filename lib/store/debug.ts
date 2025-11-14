import { create } from 'zustand';
import type { ErrorCapture, DebugFix } from '@/types/debug';

type DebugState = {
	activeError?: ErrorCapture;
	fixes: DebugFix[];
	setActiveError: (error?: ErrorCapture) => void;
	setFixes: (fixes: DebugFix[]) => void;
	clear: () => void;
};

export const useDebugStore = create<DebugState>((set) => ({
	activeError: undefined,
	fixes: [],
	setActiveError: (error) => set({ activeError: error }),
	setFixes: (fixes) => set({ fixes }),
	clear: () => set({ activeError: undefined, fixes: [] }),
}));

