import { create } from 'zustand';

/**
 * Feature-local selection of prestataires for the search page bottom bar
 * (ported from logic.ts `state.selection` + toggleSelect/clearSelection).
 */
interface SelectionState {
  selected: string[];
}

export const useSelectionStore = create<SelectionState>(() => ({ selected: [] }));

export const selectionActions = {
  toggle(id: string): void {
    useSelectionStore.setState((s) => ({
      selected: s.selected.includes(id) ? s.selected.filter((x) => x !== id) : [...s.selected, id],
    }));
  },
  clear(): void {
    useSelectionStore.setState({ selected: [] });
  },
};
