import { create } from 'zustand';
import type { ErrorCapture } from '@/types/debug';

type SandboxErrorsState = {
  errors: ErrorCapture[];
  addError: (error: ErrorCapture) => void;
  clearErrors: () => void;
  removeError: (index: number) => void;
};

export const useSandboxErrorsStore = create<SandboxErrorsState>((set) => ({
  errors: [],
  addError: (error) => {
    set((state) => ({
      errors: [...state.errors, error]
    }));
    
    // Also dispatch custom event for non-React consumers
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('sandbox-error', {
          detail: error
        })
      );
    }
  },
  clearErrors: () => set({ errors: [] }),
  removeError: (index) => {
    set((state) => ({
      errors: state.errors.filter((_, i) => i !== index)
    }));
  }
}));

