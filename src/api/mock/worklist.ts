// GET /commandes/worklist — mock twin of the real endpoint. Derives the
// server-computed row shape (currentStatus, nextStatus, ball, SLA, …) from the
// mock db, so the page renders identically with VITE_API_MOCK on or off.
// The projection logic (setupProj/cmdState/statutKey/urgencyRank) is ported
// verbatim from src/admin/logic.ts renderVals(), previously in WorklistPage.
import { t, type TKey } from '@/lib/i18n';
import type { Ball, Commande, Occurrence, OccStatus } from '@/features/commandes/schemas/commande';
import type { WorklistItem, WorklistKpis, WorklistResponse } from '@/features/commandes/schemas/worklist';
import type { MockHandler } from './router';
import { db, currentOcc, toISO } from './db';

/**
 * Traité flags for PATCH /commandes/worklist/:id/traite. The mock db has no
 * per-commande field for it, so the twin keeps them here: module state lives as
 * long as the page, which is what the rest of the mock does too.
 */
export const traiteFlags = new Map<string, { traite: boolean; at: string | null }>();

/** API ball vocabulary → the internal one the projection uses. */
const PARAM_TO_BALL: Record<string, string | undefined> = {
  de9de9: 'de9',
  client: 'client',
  prestataire: 'pro',
};

interface Proj {
  ball: Ball;
  badgeKey: TKey;
}

const OCC_PROJ: Record<OccStatus, Proj> = {
  added: { ball: 'de9', badgeKey: 'consoleBadgeAPlanifier' },
  toConfirm: { ball: 'client', badgeKey: 'consoleBadgeAConfirmer' },
  confirmed: { ball: 'pro', badgeKey: 'consoleBadgeConfirmee' },
  confirmedAssigned: { ball: 'de9', badgeKey: 'consoleBadgeOuvrierAffecte' },
  doneNoInvoice: { ball: 'pro', badgeKey: 'consoleBadgeRealiseeSansFacture' },
  doneInvoiced: { ball: 'client', badgeKey: 'consoleBadgeFactureDeposee' },
  doneDisputed: { ball: 'de9', badgeKey: 'consoleBadgeContestee' },
  doneApproved: { ball: 'de9', badgeKey: 'consoleBadgeApprouvee' },
  paid: { ball: 'done', badgeKey: 'consoleBadgePayee' },
  cancelled: { ball: 'done', badgeKey: 'consoleBadgeAnnulee' },
};

function setupProj(cmd: Commande): Proj | null {
  if (cmd.setup === 'arappeler') return { ball: 'de9', badgeKey: 'fSArappeler' };
  if (cmd.setup === 'contacte') return { ball: 'de9', badgeKey: 'consoleDevisADemander' };
  if (cmd.setup === 'devis') {
    const dv = cmd.devis ?? [];
    const anyRecu = dv.some((d) => d.status === 'recu');
    const anyValide = dv.some((d) => d.status === 'valide');
    if (cmd.proposedToClient && anyValide) return { ball: 'client', badgeKey: 'consoleDevisTransmisAttente' };
    if (anyRecu || anyValide) return { ball: 'de9', badgeKey: 'consoleDevisAValider' };
    return { ball: 'pro', badgeKey: 'consoleAttenteDevis' };
  }
  return null; // assigne → handled by occurrences
}

interface CmdState {
  kind: 'setup' | 'occ' | 'done';
  proj: Proj | null;
  occ: Occurrence | null;
}

function cmdState(cmd: Commande): CmdState {
  if (cmd.setup !== 'assigne') return { kind: 'setup', proj: setupProj(cmd), occ: null };
  const o = currentOcc(cmd);
  if (!o) return { kind: 'done', proj: null, occ: null };
  return { kind: 'occ', proj: OCC_PROJ[o.status], occ: o };
}

function urgencyRank(cmd: Commande): number {
  const st = cmdState(cmd);
  if (cmd.setup === 'arappeler') return cmd.sla.mins < 0 ? -1 : 0;
  if (st.kind === 'done') return 9;
  const ball: Ball = st.proj ? st.proj.ball : 'done';
  const k = st.occ ? st.occ.status : cmd.setup;
  if (k === 'doneDisputed') return 1;
  if (k === 'doneApproved') return 2;
  if (cmd.setup === 'contacte') return 3;
  if (k === 'added') return 4;
  return ball === 'de9' ? 5 : 6;
}

/**
 * The row's status code in the API's own vocabulary (S1…V7, V5·C, VX), read
 * from the same FLOW table that builds `currentStatus`. The twin used to
 * answer its own keys ('arappeler', 'litige', …), which the live API refuses
 * with 400 — so the filter now compares like for like.
 */
function statutKey(c: Commande): string {
  const key = flowKey(c, projectCommande(c));
  return FLOW[key]?.code ?? '';
}

/** The server-computed status fields, shared with the commande-detail mock. */
export interface CommandeVals {
  canonicalStatus: string;
  statusLabel: string;
  ball: Ball;
  needsDe9de9: boolean;
  isTerminal: boolean;
  /** The occurrence the status is read from; null during setup and once done. */
  occ: Occurrence | null;
}

/**
 * Project a mock commande onto the status vocabulary the real API computes
 * server-side. The mock keeps its own status codes (`assigne`, `doneInvoiced`,
 * …) where the API answers S-codes (`S4`) — both are open strings in the
 * schemas, and the label is what the UI actually renders.
 */
export function projectCommande(c: Commande): CommandeVals {
  const st = cmdState(c);
  const proj = st.proj;
  const lastOcc = c.occurrences[c.occurrences.length - 1];
  return {
    canonicalStatus: st.occ
      ? st.occ.status
      : st.kind === 'done'
        ? (lastOcc?.status ?? 'paid')
        : c.setup,
    statusLabel: proj ? t(proj.badgeKey) : t('commonTermine'),
    ball: proj ? proj.ball : 'done',
    needsDe9de9: proj !== null && proj.ball === 'de9',
    isTerminal: st.kind === 'done',
    occ: st.occ,
  };
}

interface Step {
  code: string;
  label: string;
  action: string;
}

/**
 * Mock status → the API's S/V pipeline: the current code, the next step and the
 * action that reaches it, and the SLA running meanwhile. Labels and actions are
 * the live payload's own French strings. `devisTransmis` is the mock's 'devis'
 * setup once a validated devis has been proposed to the client (S4).
 */
const FLOW: Record<string, { code: string; next: Step | null; sla: [string, string] | null }> = {
  arappeler: { code: 'S1', next: { code: 'S2', label: 'Devis à demander', action: 'Appeler le client' }, sla: ['rappel_client', 'Rappeler le client'] },
  contacte: { code: 'S2', next: { code: 'S3', label: 'En attente des devis', action: 'Demander les devis' }, sla: ['envoi_brief', 'Envoyer le brief'] },
  devis: { code: 'S3', next: { code: 'S4', label: 'Devis transmis (attente choix)', action: 'Proposer au client' }, sla: ['relance_prestataires', 'Relancer les prestataires'] },
  devisTransmis: { code: 'S4', next: { code: 'V1', label: 'À confirmer', action: 'Choisir le prestataire' }, sla: ['choix_prestataire', 'Faire choisir le prestataire'] },
  added: { code: 'V0', next: { code: 'V1', label: 'À confirmer', action: "Planifier l'occurrence" }, sla: ['planification', 'Planifier la visite'] },
  toConfirm: { code: 'V1', next: { code: 'V2', label: 'Confirmée', action: 'Confirmer la visite' }, sla: ['confirmation_client', 'Faire confirmer la date'] },
  confirmed: { code: 'V2', next: { code: 'V3', label: 'Ouvrier affecté', action: 'Affecter un ouvrier' }, sla: ['affectation_ouvriers', 'Faire affecter les ouvriers'] },
  confirmedAssigned: { code: 'V3', next: { code: 'V4', label: 'Terminée', action: 'Marquer la visite réalisée' }, sla: null },
  doneNoInvoice: { code: 'V4', next: { code: 'V5', label: 'Facture déposée', action: 'Déposer la facture' }, sla: ['depot_facture', 'Faire déposer la facture'] },
  doneInvoiced: { code: 'V5', next: { code: 'V6', label: 'Approuvée', action: 'Approuver la facture' }, sla: ['approbation_facture', 'Faire approuver la facture'] },
  doneDisputed: { code: 'V5·C', next: { code: 'V5', label: 'Facture déposée', action: 'Résoudre le litige' }, sla: ['resolution_litige', 'Résoudre le litige'] },
  doneApproved: { code: 'V6', next: { code: 'V7', label: 'Réglée', action: 'Régler (pro + prestataire)' }, sla: ['versement', 'Régler le versement'] },
  paid: { code: 'V7', next: null, sla: null },
  cancelled: { code: 'V✕', next: null, sla: null },
};

/** The row's step in FLOW — the mock status, with S3/S4 split on the proposal. */
export function flowKey(c: Commande, vals: CommandeVals): string {
  if (vals.canonicalStatus !== 'devis') return vals.canonicalStatus;
  const proposed = c.proposedToClient && (c.devis ?? []).some((d) => d.status === 'valide');
  return proposed ? 'devisTransmis' : 'devis';
}

/** An occurrence's own S/V code and label — for the detail twin's occurrence list. */
export function occStatus(o: Occurrence): { code: string; label: string } {
  return { code: FLOW[o.status]?.code ?? o.status, label: t(OCC_PROJ[o.status].badgeKey) };
}

/** dd/mm/yyyy → an ISO timestamp, or null when absent/malformed. */
function isoOf(ddmmyyyy: string | undefined): string | null {
  const d = ddmmyyyy ? toISO(ddmmyyyy) : '';
  return d ? d + 'T00:00:00+00:00' : null;
}

/** Numeric brief budget only — the prototype also stores free text there. */
function budget(v: number | string | undefined): number | null {
  return typeof v === 'number' ? v : null;
}

/**
 * The mock db has no company UUIDs, so the client/prestataire names double as
 * stable pseudo-ids — the page builds its filter options from the rows, so the
 * ids only ever round-trip back here.
 */
export function toRow(c: Commande): WorklistItem {
  const vals = projectCommande(c);
  const flow = FLOW[flowKey(c, vals)];
  const isVisit = c.setup === 'assigne';
  const occIndex = vals.occ ? c.occurrences.indexOf(vals.occ) : -1;
  // db stores minutes-remaining (negative = late); the API contract is
  // minutes-overdue (positive = late), null while the SLA is still running.
  const callbackSla = c.setup === 'arappeler';
  const overdue = callbackSla && c.sla.mins < 0 ? -c.sla.mins : null;
  return {
    id: c.id,
    kind: c.type,
    clientName: c.client,
    reference: c.brief?.ref ?? c.id,
    clientContact: c.phone,
    contact: c.contact,
    clientPhone: c.phone,
    clientEmail: c.clientEmail,
    clientCompanyId: c.client,
    serviceLabel: c.service,
    wilaya: c.wilaya,
    commune: c.commune,
    cadence: c.pattern,
    currentStatus: { code: flow?.code ?? vals.canonicalStatus, label: vals.statusLabel },
    nextStatus: flow?.next ?? null,
    ball: vals.ball,
    needsDe9de9: vals.needsDe9de9,
    prestataireCompanyId: c.prestataire?.name ?? null,
    prestataireName: c.prestataire?.name ?? null,
    nextVisitAt: vals.occ ? isoOf(vals.occ.date) : null,
    statusSince: null, // not tracked in the mock db
    slaOverdueMinutes: overdue,
    slaCode: flow?.sla?.[0] ?? null,
    slaLabel: flow?.sla?.[1] ?? null,
    slaDueAt: callbackSla ? new Date(Date.now() + c.sla.mins * 60_000).toISOString() : null,
    traite: traiteFlags.get(c.id)?.traite ?? false,
    traiteAt: traiteFlags.get(c.id)?.at ?? null,
    traiteParUserId: null,
    noteCount: c.notes.length,
    noteIds: c.notes.map((_, i) => `${c.id}:note:${i}`),
    budgetMinCredits: isVisit ? null : budget(c.brief?.budgetMin),
    budgetMaxCredits: isVisit ? null : budget(c.brief?.budgetMax),
    dateSouhaitee: null,
    // Client KYC lives behind /kyc/client:<name> in the mock, not on the commande.
    clientKycBloquePublication: null,
    clientKycStatut: null,
    contractId: isVisit ? c.id : null,
    contractStartsAt: isVisit ? isoOf(c.occurrences[0]?.date) : null,
    contractEndsAt: isVisit ? isoOf(c.occurrences[c.occurrences.length - 1]?.date) : null,
    visitAddress: isVisit ? (c.brief?.adresse ?? null) : null,
    workerCount: vals.occ ? (vals.occ.ouvrier ? 1 : 0) : null,
    occurrenceNumber: occIndex >= 0 ? occIndex + 1 : null,
    occurrenceCount: isVisit ? c.occurrences.length : null,
    createdAt: new Date().toISOString(), // not tracked in the mock db
  };
}

export const worklistHandler: MockHandler = (req) => {
  const q = req.query;
  let list = db.commandes.slice().sort((a, b) => urgencyRank(a) - urgencyRank(b));

  if (q['clientId']) list = list.filter((c) => c.client === q['clientId']);
  if (q['prestataireId']) list = list.filter((c) => c.prestataire?.name === q['prestataireId']);
  if (q['wilaya']) list = list.filter((c) => c.wilaya === q['wilaya']);
  if (q['commune']) list = list.filter((c) => c.commune === q['commune']);
  if (q['statut']) list = list.filter((c) => statutKey(c) === q['statut']);
  if (q['balle']) {
    // The API's vocabulary, aliased to the internal one for the comparison.
    const wanted = PARAM_TO_BALL[q['balle']];
    list = wanted ? list.filter((c) => (cmdState(c).proj?.ball ?? 'done') === wanted) : [];
  }
  if (q['needsDe9de9'] === 'true') {
    list = list.filter((c) => cmdState(c).proj?.ball === 'de9');
  }
  if (q['cadence']) {
    list = list.filter((c) => (c.type === 'recurrent' ? 'recurrent' : 'ponctuel') === q['cadence']);
  }
  if (q['traite'] === 'true' || q['traite'] === 'false') {
    const want = q['traite'] === 'true';
    list = list.filter((c) => (traiteFlags.get(c.id)?.traite ?? false) === want);
  }
  if (q['enRetard'] === 'true') {
    list = list.filter((c) => c.sla.mins < 0);
  }
  const search = (q['search'] ?? '').trim().toLowerCase();
  if (search) {
    list = list.filter((c) => {
      const pres = c.prestataire?.name.toLowerCase() ?? '';
      const presEmail = c.prestataire?.email?.toLowerCase() ?? '';
      return (
        c.id.toLowerCase().includes(search) ||
        c.client.toLowerCase().includes(search) ||
        pres.includes(search) ||
        c.clientEmail.toLowerCase().includes(search) ||
        presEmail.includes(search)
      );
    });
  }

  const pageSize = Math.max(1, Number(q['pageSize']) || 20);
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const page = Math.min(Math.max(1, Number(q['page']) || 1), totalPages);
  const data: WorklistResponse = {
    meta: {
      current_page: page,
      per_page: pageSize,
      total: list.length,
      total_pages: totalPages,
      has_more_pages: page < totalPages,
    },
    data: list.slice((page - 1) * pageSize, page * pageSize).map(toRow),
  };
  return { data };
};

/**
 * GET /commandes/worklist/kpis — counts over the whole mock list, bucketed like
 * the `statut` filter. Each mock commande stands for one contract, so
 * `commandesActives` counts commandes, as the live endpoint counts contracts.
 */
export const worklistKpisHandler: MockHandler = () => {
  const count = (key: string) => db.commandes.filter((c) => statutKey(c) === key).length;
  const data: WorklistKpis = {
    aRappeler: count('arappeler'),
    litigesAResoudre: count('litige'),
    facturesARegler: count('regler'),
    commandesActives: count('actif'),
  };
  return { data };
};

/**
 * GET /commandes/worklist/filters — twin of the dropdown source. Built from the
 * mock db so the page fills the same selects with VITE_API_MOCK on or off.
 * `q` narrows company names only (not wilayas); `limit` caps each list and sets
 * `truncated`, exactly as the live route documents.
 */
export const worklistFiltersHandler: MockHandler = (req) => {
  const q = (req.query['q'] ?? '').trim().toLowerCase();
  const limit = Math.min(Math.max(1, Number(req.query['limit']) || 100), 500);
  const match = (label: string): boolean => !q || label.toLowerCase().includes(q);

  const uniq = (pairs: [string, string][]): { value: string; label: string }[] => {
    const seen = new Map<string, string>();
    for (const [value, label] of pairs) if (value && label && !seen.has(value)) seen.set(value, label);
    return [...seen].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  };

  const clients = uniq(db.commandes.map((c) => [c.client, c.client] as [string, string])).filter((o) =>
    match(o.label),
  );
  const prestataires = uniq(
    db.commandes.filter((c) => c.prestataire).map((c) => [c.prestataire!.name, c.prestataire!.name] as [string, string]),
  ).filter((o) => match(o.label));
  const wilayas = [...new Set(db.commandes.map((c) => c.wilaya).filter(Boolean))].sort();
  const communes = [...new Set(db.commandes.map((c) => c.commune).filter(Boolean))].sort();

  // Only the statuses the file actually shows, in the documented order.
  const VISIBLE = ['S1', 'S2', 'S3', 'S4', 'S5', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V5·C', 'V6'];
  const labelOf = (code: string): string => {
    for (const step of Object.values(FLOW)) {
      if (step.code === code) return step.next?.label ?? code;
    }
    return code;
  };
  const statuts = VISIBLE.map((code) => ({ value: code, label: labelOf(code) }));

  const slaTargets = Object.values(FLOW)
    .filter((f) => f.sla)
    .map((f) => ({
      status: { code: f.code, label: f.next?.label ?? f.code },
      code: f.sla?.[0] ?? null,
      label: f.sla?.[1] ?? null,
      minutes: 60,
    }));

  const cut = <T,>(xs: T[]): T[] => xs.slice(0, limit);
  const truncated =
    clients.length > limit || prestataires.length > limit || wilayas.length > limit || communes.length > limit;

  return {
    data: {
      filters: {
        clients: cut(clients),
        prestataires: cut(prestataires),
        wilayas: cut(wilayas),
        communes: cut(communes),
        statuts,
        balles: ['de9de9', 'client', 'prestataire'],
        cadences: [
          { value: 'ponctuel', label: 'Ponctuel' },
          { value: 'recurrent', label: 'Récurrent' },
        ],
        slaTargets,
      },
      gaps: [],
      truncated,
      limit,
    },
  };
};
