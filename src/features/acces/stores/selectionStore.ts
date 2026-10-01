import { create } from 'zustand';
import type { AccesEntreprise } from '../schemas/acces';
import { SELECTION_MAX } from '../lib/acces';

/**
 * What the « Accès » page keeps of a ticked company. Selected rows can sit on
 * another page, under another filter or another search, so the bar and the
 * dialogs read their names from here, not from the rows on screen.
 */
export interface AccesSnapshot {
  nom: string;
  active: boolean;
  roles: string[];
  b2cAcces: boolean;
  b2bAcces: boolean;
}

/** A company an action is about to be sent for. */
export interface AccesTarget extends AccesSnapshot {
  id: string;
}

export function targetOf(row: AccesEntreprise): AccesTarget {
  return {
    id: row.id,
    nom: row.nom ?? row.raisonSociale ?? row.id,
    active: row.active !== false,
    roles: row.roles ?? [],
    b2cAcces: row.b2cAcces,
    b2bAcces: row.b2bAcces,
  };
}

/**
 * Feature-local selection of the « Accès » page — client-side only: nothing is
 * sent until a bulk button is pressed. A Map keeps the order the rows were
 * ticked in; every change swaps in a new Map so subscribers re-render.
 */
interface SelectionState {
  selected: ReadonlyMap<string, AccesSnapshot>;
}

export const useAccesSelection = create<SelectionState>(() => ({ selected: new Map() }));

const snapshotOf = (target: AccesTarget): AccesSnapshot => ({
  nom: target.nom,
  active: target.active,
  roles: target.roles,
  b2cAcces: target.b2cAcces,
  b2bAcces: target.b2bAcces,
});

export const accesSelection = {
  /** Tick or untick one row; a 201st company is refused (the API's limit per send). */
  toggle(target: AccesTarget): void {
    useAccesSelection.setState((s) => {
      const next = new Map(s.selected);
      if (next.has(target.id)) next.delete(target.id);
      else if (next.size < SELECTION_MAX) next.set(target.id, snapshotOf(target));
      else return s;
      return { selected: next };
    });
  },
  /** The header checkbox: tick the page's rows (up to the limit), or untick them and only them. */
  setPage(targets: AccesTarget[], on: boolean): void {
    useAccesSelection.setState((s) => {
      const next = new Map(s.selected);
      for (const target of targets) {
        if (!on) next.delete(target.id);
        else if (next.has(target.id) || next.size < SELECTION_MAX) next.set(target.id, snapshotOf(target));
      }
      return { selected: next };
    });
  },
  /** « Resélectionner les ignorées » — the selection becomes exactly these companies. */
  replace(targets: AccesTarget[]): void {
    useAccesSelection.setState({
      selected: new Map(targets.slice(0, SELECTION_MAX).map((target) => [target.id, snapshotOf(target)])),
    });
  },
  clear(): void {
    useAccesSelection.setState((s) => (s.selected.size ? { selected: new Map() } : s));
  },
};

/** The selection as the dialogs take it. */
export function targetsOf(selected: ReadonlyMap<string, AccesSnapshot>): AccesTarget[] {
  return [...selected].map(([id, snapshot]) => ({ id, ...snapshot }));
}
