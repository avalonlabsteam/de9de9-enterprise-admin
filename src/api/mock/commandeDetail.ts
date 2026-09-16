// GET /commandes/:id — mock twin of the real endpoint's status projection
// envelope (per-role canonicalStatus / ball / allowedActions + money). The
// status fields come from `projectCommande`, the same logic the worklist mock
// uses, so both endpoints agree on a commande's state.
import type { Commande } from '@/features/commandes/schemas/commande';
import {
  COMMANDE_ROLES,
  type CommandeDetail,
  type CommandeExtras,
  type CommandeProjection,
  type CommandeRole,
} from '@/features/commandes/schemas/commandeDetail';
import { toISO } from './db';
import { projectCommande, type CommandeVals } from './worklist';

/** DZD → credits, the ratio the live payload shows (620 000 → 6 200 000). */
const CREDITS_PER_DZD = 10;

/** Whose turn it is, per audience — the mock's ball values map 1:1 onto roles. */
const BALL_OF_ROLE: Record<CommandeRole, string> = {
  client: 'client',
  prestataire: 'pro',
  admin: 'de9',
};

/** A visit still counts as open until it is paid or cancelled. */
const CLOSED_OCC_STATUSES = new Set(['paid', 'cancelled']);

/** The contract value: the chosen devis, else the chosen quick quote. */
function amountDzd(c: Commande): number | null {
  const devis = c.devis?.find((d) => d.chosen);
  if (devis) return devis.montant;
  const quote = c.quotes.find((q) => q.chosen);
  return quote ? quote.montant : null;
}

function extrasOf(c: Commande): CommandeExtras {
  const dates = c.occurrences.map((o) => toISO(o.date)).filter((d) => d !== '');
  return {
    contractId: c.id,
    reference: c.brief?.ref ?? c.id,
    // The mock db has no company UUIDs — names double as stable pseudo-ids,
    // same convention as the worklist rows.
    clientCompanyId: c.client,
    prestataireCompanyId: c.prestataire?.name ?? null,
    appelOffreId: null, // no appel d'offres in the mock db
    acceptedDevisId: c.devis?.find((d) => d.chosen)?.presId ?? null,
    startDate: dates[0] ?? null,
    endDate: dates[dates.length - 1] ?? null,
    isClosed: c.occurrences.length > 0 && c.occurrences.every((o) => CLOSED_OCC_STATUSES.has(o.status)),
    visitCount: c.occurrences.length,
    openVisitCount: c.occurrences.filter((o) => !CLOSED_OCC_STATUSES.has(o.status)).length,
    createdAt: new Date().toISOString(), // not tracked in the mock db
    updatedAt: null,
  };
}

function projectionOf(role: CommandeRole, vals: CommandeVals, extras: CommandeExtras): CommandeProjection {
  return {
    role,
    canonicalStatus: vals.canonicalStatus,
    statusLabel: vals.statusLabel,
    ball: vals.ball,
    demandeBadge: 'none',
    isActionRequired: !vals.isTerminal && vals.ball === BALL_OF_ROLE[role],
    isTerminal: vals.isTerminal,
    // The mock console derives its buttons client-side from the commande
    // payload, so there is no server-side action vocabulary to mirror here.
    allowedActions: [],
    extras,
  };
}

/** Build the projection envelope for one mock commande. */
export function commandeDetailOf(c: Commande): CommandeDetail {
  const vals = projectCommande(c);
  const extras = extrasOf(c);
  const amount = amountDzd(c);
  return {
    id: c.id,
    canonicalStatus: vals.canonicalStatus,
    statusLabel: vals.statusLabel,
    projections: Object.fromEntries(
      COMMANDE_ROLES.map((role) => [role, projectionOf(role, vals, extras)]),
    ),
    ball: vals.ball,
    demandeBadge: 'none',
    allowedActions: [],
    money: {
      amountDzd: amount,
      credits: amount === null ? null : amount * CREDITS_PER_DZD,
      ledgerImpact: 'none',
    },
  };
}
