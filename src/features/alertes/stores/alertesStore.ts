import { create } from 'zustand';
import type { Alerte, AlerteCompteurs } from '../schemas/alertes';

// The console's alert rows, kept by id (guide 11 §6). Live pushes, catch-ups
// and the drawer's pages all land here, so a row delivered twice is kept once
// and its read state is the same everywhere. The numbers (badge, chips) come
// only from `compteurs` — never counted from this list, which is paged,
// filtered, and read by other admins too.

interface AlertesState {
  byId: Record<string, Alerte>;
  compteurs: AlerteCompteurs | null;
  drawerOpen: boolean;
}

const empty: AlertesState = { byId: {}, compteurs: null, drawerOpen: false };

export const useAlertesStore = create<AlertesState>()(() => empty);

/** `creeLe` as a number — compared parsed, so a push and a page with different precision still order. */
function at(a: Alerte): number {
  const ms = Date.parse(a.creeLe);
  return Number.isNaN(ms) ? 0 : ms;
}

/** The server's order: newest first, then id descending. */
export function sortAlertes(list: Alerte[]): Alerte[] {
  return [...list].sort((x, y) => at(y) - at(x) || y.id.localeCompare(x.id));
}

export const alertesActions = {
  /**
   * Keep one row per id. Answers true for an id the console did not hold (a
   * toast is allowed). A known row is only replaced to become read — read
   * state never goes back to unread.
   */
  add: (a: Alerte): boolean => {
    const known = useAlertesStore.getState().byId[a.id];
    if (known) {
      if (a.lu && !known.lu) {
        useAlertesStore.setState((s) => ({ byId: { ...s.byId, [a.id]: a } }));
      }
      return false;
    }
    useAlertesStore.setState((s) => ({ byId: { ...s.byId, [a.id]: a } }));
    return true;
  },

  /** Merge a REST page; answers the rows that were new. */
  merge: (list: Alerte[]): Alerte[] => list.filter((a) => alertesActions.add(a)),

  /** First load, or away too long: the list starts over from this page. */
  replace: (list: Alerte[]): void => {
    useAlertesStore.setState({ byId: Object.fromEntries(list.map((a) => [a.id, a])) });
  },

  clear: (): void => useAlertesStore.setState(empty),

  setCompteurs: (c: AlerteCompteurs): void => useAlertesStore.setState({ compteurs: c }),

  /** Optimistic « read » on a tap: bold → normal, dot off. */
  markRead: (id: string): void => {
    const a = useAlertesStore.getState().byId[id];
    if (!a || a.lu) return;
    useAlertesStore.setState((s) => ({
      byId: { ...s.byId, [id]: { ...a, lu: true, luLe: new Date().toISOString() } },
    }));
  },

  /** Roll the optimistic read back when the server refused it. */
  unmarkRead: (id: string): void => {
    const a = useAlertesStore.getState().byId[id];
    if (!a) return;
    useAlertesStore.setState((s) => ({ byId: { ...s.byId, [id]: { ...a, lu: false, luLe: null } } }));
  },

  /** « Tout marquer comme lu » succeeded: mirror it on the rows held (one category, or all). */
  markAllRead: (categorie: string | null): void => {
    const now = new Date().toISOString();
    useAlertesStore.setState((s) => {
      const byId: Record<string, Alerte> = {};
      for (const [id, a] of Object.entries(s.byId)) {
        byId[id] = !a.lu && (!categorie || a.categorie === categorie) ? { ...a, lu: true, luLe: now } : a;
      }
      return { byId };
    });
  },

  /** Max `creeLe` held, as epoch ms — the catch-up cursor. Null when nothing is held. */
  newestAt: (): number | null => {
    let newest: number | null = null;
    for (const a of Object.values(useAlertesStore.getState().byId)) {
      const ms = at(a);
      if (ms > 0 && (newest === null || ms > newest)) newest = ms;
    }
    return newest;
  },

  unreadHeld: (): number => Object.values(useAlertesStore.getState().byId).filter((a) => !a.lu).length,

  setDrawerOpen: (open: boolean): void => useAlertesStore.setState({ drawerOpen: open }),
};
