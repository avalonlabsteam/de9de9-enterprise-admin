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
  /**
   * Company ids (lower-cased) a send refused because their B2B access is
   * suspended: their cards are marked until the search page is left — the
   * results on screen predate the suspension.
   */
  fermes: string[];
  /**
   * The category of the annonce « Demander un devis » was last asked on. A new
   * object per ask: the search page takes it as its filter each time, the same
   * category twice included.
   */
  categorieDemandee: { code: string } | null;
}

export const useSelectionStore = create<SelectionState>(() => ({
  selected: [],
  names: {},
  fermes: [],
  categorieDemandee: null,
}));

export const selectionActions = {
  toggle(id: string, name?: string): void {
    useSelectionStore.setState((s) => ({
      selected: s.selected.includes(id) ? s.selected.filter((x) => x !== id) : [...s.selected, id],
      names: name ? { ...s.names, [id]: name } : s.names,
    }));
  },
  /** 422 `prestataire_b2b_disabled`: these recipients leave the selection and their cards are marked. */
  closeB2b(ids: string[]): void {
    const closed = ids.map((id) => id.toLowerCase());
    useSelectionStore.setState((s) => ({
      selected: s.selected.filter((id) => !closed.includes(id.toLowerCase())),
      fermes: [...new Set([...s.fermes, ...closed])],
    }));
  },
  /** « Demander un devis » on an annonce row, from a card or from the profile overlay. */
  askCategory(code: string): void {
    useSelectionStore.setState({ categorieDemandee: { code } });
  },
  forgetClosed(): void {
    useSelectionStore.setState((s) => (s.fermes.length ? { fermes: [] } : s));
  },
  clear(): void {
    useSelectionStore.setState({ selected: [], names: {}, categorieDemandee: null });
  },
};
