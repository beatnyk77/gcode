import { create } from 'zustand';

export type VibePreset = 'scrappy' | 'enterprise' | 'a11y' | undefined;

type UIState = {
	selectedVibe: VibePreset;
	setVibe: (v: VibePreset) => void;
};

export const useUIStore = create<UIState>((set) => ({
	selectedVibe: undefined,
	setVibe: (v) => set({ selectedVibe: v })
}));


