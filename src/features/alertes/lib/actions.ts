import axios from 'axios';
import type { QueryKey } from '@tanstack/react-query';
import type { NavigateFunction } from 'react-router-dom';
import { queryClient } from '@/lib/queryClient';
import { postAlerteLue } from '../api/alertes';
import type { Alerte, FileSignal } from '../schemas/alertes';
import { alertesActions } from '../stores/alertesStore';
import { targetOf } from './alertes';

/**
 * A tap on a row or a toast (guide 11 §8): mark it read — optimistic, rolled
 * back unless the server says the row is gone (404) — then go where the
 * server said. A row with no target only informs: it stays where it is.
 */
export function openAlerte(a: Alerte, navigate: NavigateFunction): void {
  if (!a.lu) {
    alertesActions.markRead(a.id);
    postAlerteLue(a.id)
      .then(alertesActions.setCompteurs)
      .catch((err: unknown) => {
        if (!(axios.isAxiosError(err) && err.response?.status === 404)) alertesActions.unmarkRead(a.id);
      });
  }
  const target = targetOf(a);
  if (!target) return;
  alertesActions.setDrawerOpen(false);
  navigate(target);
}

/**
 * Hub `file` → the console queries that queue feeds (guide 11a §5). Keys are
 * prefixes: TanStack refetches only what is on screen and marks the rest
 * stale, so a queue nobody is looking at costs nothing now and is fresh when
 * opened. No toast, and list queries keep their previous data while they
 * refetch, so nothing jumps.
 */
const QUEUE_KEYS: Record<string, (f: FileSignal) => QueryKey[]> = {
  // Worklist rows, counters, and the open commande (its detail sits under the same prefix).
  worklist: () => [['commandes']],
  // Every verdict: the queue, the counters, an open review — and the company's
  // page and fiches, whose ✓ badge follows the dossier turning « Vérifié ».
  kyc: (f) => [
    ['kyc', 'list'],
    ['kyc', 'kpis'],
    ...(f.companyId ? [['kyc', 'revue', f.companyId], ['kyc', 'audit', f.companyId]] : []),
    ...companyKeys(f.companyId),
  ],
  factures: (f) => [['factures', 'console'], ['factures', 'kpis'], ...(f.cibleId ? [['factures', 'detail', f.cibleId]] : [])],
  // Ledger, counters, an open movement, the client fiches' credits, and the
  // online payments (« Paiement en ligne à vérifier », guide 18 §12).
  credits: () => [['credits'], ['comptabilite']],
  // « Sous-traitance » and the demande screen read the same contractuel demandes.
  soustraitance: () => [['contractuels']],
  contractuels: () => [['contractuels']],
  handicap: () => [['handicap']],
  // A company's page and fiches, and « Accès » (list, counters, badge, sync
  // state): a refused or failed sync with the de9de9 app arrives on this file.
  entreprises: (f) => [...companyKeys(f.companyId), ['acces']],
  b2c: (f) => [...companyKeys(f.companyId), ['acces']],
};

function companyKeys(companyId: string | null | undefined): QueryKey[] {
  if (!companyId) return [];
  return [['entreprises', companyId], ['prestataires', companyId], ['credits', 'client', companyId]];
}

export function invalidateQueue(f: FileSignal): void {
  for (const queryKey of QUEUE_KEYS[f.file]?.(f) ?? []) void queryClient.invalidateQueries({ queryKey });
}

/**
 * Alerts that change a page without a queue signal (`file`): the annonces —
 * their queue, the menu badge and an open annonce refresh on any `annonce.*`,
 * and so do the prestataire cards and fiches, which list the published B2B ones.
 */
export function invalidateForAlerte(a: Alerte): void {
  if (!a.code?.startsWith('annonce.')) return;
  void queryClient.invalidateQueries({ queryKey: ['annonces'] });
  void queryClient.invalidateQueries({ queryKey: ['prestataires'] });
}

/** The alert is about the screen on display: refresh what it shows instead of toasting. */
export function refreshScreen(): void {
  void queryClient.invalidateQueries({ type: 'active' });
}
