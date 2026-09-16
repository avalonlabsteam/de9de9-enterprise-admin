import { create } from 'zustand';

/**
 * Feature-local selection of prestataires for the search page bottom bar
 * (ported from logic.ts `state.selection` + toggleSelect/clearSelection).
 * Display names are captured at selection time, so the bar can label entries
 * even after the paginated search results have moved to another page.
 */
interface SelectionState {
  selected: string[];
  names: Record<string, string>;
}

export const useSelectionStore = create<SelectionState>(() => ({ selected: [], names: {} }));

export const selectionActions = {
  toggle(id: string, name?: string): void {
    useSelectionStore.setState((s) => ({
      selected: s.selected.includes(id) ? s.selected.filter((x) => x !== id) : [...s.selected, id],
      names: name ? { ...s.names, [id]: name } : s.names,
    }));
  },
  clear(): void {
    useSelectionStore.setState({ selected: [], names: {} });
  },
};
