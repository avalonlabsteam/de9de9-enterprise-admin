// GET  /commandes/worklist/:id              — mock twin of the worklist-row detail
// POST /commandes/worklist/:id/next-action  — mock twin of running its next action
//
// Built on the list row (`toRow`) so both endpoints agree on status, next step
// and SLA, then extended with the commande's parties, devis, notes, occurrences
// and journal in the contract's shapes.
//
// Approximations, since the mock db can't reproduce them: each party's `text`
// is the next action for whoever holds the ball and the status label for the
// others (live texts are role-specific projections); `choosable` is "validated
// and proposed, no prestataire yet"; a note is `aFaire` until handled. The
// `form` keys 'demander-devis', 'choisir-prestataire' and 'affecter-ouvrier' are
// the live ones; 'deposer-facture' is still a mock name.
import type { Ball, Commande } from '@/features/commandes/schemas/commande';
import type { WorklistItem } from '@/features/commandes/schemas/worklist';
import type { WorklistDetailInput } from '@/features/commandes/schemas/worklistDetail';
import type { MockHandler, MockResponse } from './router';
import { addAudit, cmdById, currentOcc, db, fromISO } from './db';
import { flowKey, occStatus, projectCommande, toRow } from './worklist';

/** The mock's ball shorthand → the API's audience names. */
const API_BALL: Record<Ball, string> = {
  client: 'client',
  pro: 'prestataire',
  de9: 'de9de9',
  done: 'none',
};

/**
 * Steps whose action needs input POST …/next-action can't carry (it has no
 * body) — the twin refuses them with 422, as the live endpoint does.
 */
const FORM_OF: Record<string, string> = {
  contacte: 'demander-devis',
  devisTransmis: 'choisir-prestataire',
  confirmed: 'affecter-ouvrier',
  doneNoInvoice: 'deposer-facture',
};

/** 'dd/mm/yyyy' or 'dd/mm/yyyy · hh:mm' (the mock's stamps) → ISO 8601. */
function stampToIso(stamp: string): string | null {
  const m = stamp.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s*·\s*(\d{2}):(\d{2}))?/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}T${m[4] ?? '00'}:${m[5] ?? '00'}:00+00:00`;
}

function partiesOf(row: WorklistItem) {
  const party = (who: Ball) => {
    if (!row.nextStatus) return { code: 'done', text: row.currentStatus.label };
    if (row.ball === who) {
      return { code: 'action_required', text: row.nextStatus.action ?? row.currentStatus.label };
    }
    return { code: 'waiting', text: row.currentStatus.label };
  };
  return { client: party('client'), prestataire: party('pro'), de9de9: party('de9') };
}

export function worklistDetailOf(c: Commande): WorklistDetailInput {
  const row = toRow(c);
  const next = row.nextStatus;
  const form = FORM_OF[flowKey(c, projectCommande(c))] ?? null;
  return {
    id: row.id,
    kind: row.kind,
    reference: row.reference,
    clientName: row.clientName,
    clientCompanyId: row.clientCompanyId,
    contact: row.contact,
    clientPhone: row.clientPhone,
    clientEmail: row.clientEmail,
    service: row.serviceLabel,
    cadence: row.cadence,
    wilaya: row.wilaya,
    commune: row.commune,
    prestataire: c.prestataire
      ? { companyId: c.prestataire.name, name: c.prestataire.name, phone: c.prestataire.phone }
      : null,
    currentStatus: row.currentStatus,
    statusEnteredAt: row.statusSince,
    ball: API_BALL[row.ball],
    parties: partiesOf(row),
    nextAction: next
      ? {
          action: next.action ?? next.label,
          actor: API_BALL[row.ball],
          from: row.currentStatus,
          to: { code: next.code, label: next.label },
          form,
          route: 'POST /api/commandes/{id}/actions',
        }
      : null,
    statusSince: row.statusSince,
    slaOverdueMinutes: row.slaOverdueMinutes,
    slaCode: row.slaCode,
    slaLabel: row.slaLabel,
    slaDueAt: row.slaDueAt,
    traite: row.traite,
    traiteAt: row.traiteAt,
    traiteParUserId: row.traiteParUserId,
    noteCount: row.noteCount,
    noteIds: row.noteIds,
    notes: c.notes.map((n, i) => ({
      id: `${c.id}:note:${i}`,
      body: n.text,
      authorUserId: null,
      authorDisplayName: n.author,
      createdAt: stampToIso(n.date) ?? n.date,
      aFaire: !n.handled,
      aFaireAt: null,
      aFaireParUserId: null,
    })),
    contractId: row.contractId,
    executionRowId: null,
    nextVisitAt: row.nextVisitAt,
    occurrences: c.occurrences.map((o, i) => ({
      id: o.id,
      number: i + 1,
      date: stampToIso(o.date),
      status: occStatus(o),
      worker: o.ouvrier,
      facture: o.facture
        ? {
            id: `${o.id}:facture`,
            reference: 'F-' + c.id.replace(/[^0-9]/g, ''),
            montantCredits: o.facture.montant,
            transfere: o.facture.transfere,
            fileName: o.facture.fileName ?? null,
          }
        : null,
    })),
    devis: (c.devis ?? []).map((d, i) => ({
      quoteIndex: i,
      // Live: an invited devis has no id yet — it gets one when it is received.
      devisId: d.status === 'attente' ? null : `${c.id}:devis:${i}`,
      prestataireCompanyId: d.presId,
      raison: d.raison,
      phone: d.phone,
      statut: d.status,
      // An invited devis has no amount yet — the live API sends null, and the
      // console shows « Devis demandé » for it. The mock db seeds 0, so map it.
      montantCredits: d.status === 'attente' ? null : d.montant,
      chosen: d.chosen === true,
      closure: 'none',
      closureLabel: null,
      choosable: d.status === 'valide' && c.proposedToClient === true && !c.prestataire,
    })),
    journal: c.audit.map((a) => ({ at: stampToIso(a.date) ?? a.date, text: a.txt, role: a.role })),
    createdAt: row.createdAt,
  };
}

export const worklistDetailHandler: MockHandler = (req) => {
  const id = req.pathParams['id'] ?? '';
  const cmd = cmdById(id);
  if (!cmd) return { status: 404, data: { message: `Ligne introuvable dans la file : ${id}` } };
  return { data: worklistDetailOf(cmd) };
};

/** RFC 7807 body, like the live 403 / 404 / 409 / 422 responses. */
function problem(status: number, title: string, detail: string): MockResponse {
  return { status, data: { type: 'about:blank', title, status, detail } };
}

/**
 * Advances the row one step, with the same state changes and journal texts as
 * the mock's POST /commandes/:id/actions cases (callClient, plan, confirmVisit,
 * realize, approve, resolve, settle). The row keeps its id, so `newId` is null.
 */
export const worklistNextActionHandler: MockHandler = (req) => {
  const id = req.pathParams['id'] ?? '';
  const cmd = cmdById(id);
  if (!cmd) return problem(404, 'Not Found', `Ligne introuvable dans la file : ${id}`);

  const key = flowKey(cmd, projectCommande(cmd));
  const form = FORM_OF[key];
  if (form) {
    return problem(422, 'Unprocessable Content', `Cette action demande le formulaire « ${form} ».`);
  }

  const occ = currentOcc(cmd);
  const noNext = () => problem(409, 'Conflict', 'Aucune action suivante pour cette ligne.');

  switch (key) {
    case 'arappeler':
      cmd.setup = 'contacte';
      addAudit(cmd, 'Client appelé — fait par de9de9.', 'de9');
      break;
    case 'devis':
      if (!(cmd.devis ?? []).some((d) => d.status === 'valide')) {
        return problem(422, 'Unprocessable Content', 'Aucun devis validé à proposer au client.');
      }
      cmd.proposedToClient = true;
      addAudit(cmd, 'Devis validés transmis au client par de9de9.', 'de9');
      break;
    case 'added':
      if (!occ) return noNext();
      occ.status = 'toConfirm';
      addAudit(cmd, 'Occurrence planifiée par de9de9.', 'de9');
      break;
    case 'toConfirm':
      if (!occ) return noNext();
      occ.status = 'confirmed';
      addAudit(cmd, 'Visite confirmée au nom du client (accord tél.).', 'client');
      break;
    case 'confirmedAssigned':
      if (!occ) return noNext();
      occ.status = 'doneNoInvoice';
      addAudit(cmd, 'Visite marquée réalisée par de9de9.', 'de9');
      break;
    case 'doneInvoiced':
      if (!occ) return noNext();
      occ.status = 'doneApproved';
      addAudit(cmd, 'Facture approuvée au nom du client (accord téléphonique). Engage les crédits du client.', 'client');
      break;
    case 'doneDisputed':
      if (!occ) return noNext();
      occ.status = 'doneInvoiced';
      addAudit(cmd, 'Litige résolu par de9de9 — facture rétablie.', 'de9');
      break;
    case 'doneApproved':
      if (!occ) return noNext();
      occ.status = 'paid';
      if (occ.facture) occ.facture.transfere = true;
      addAudit(cmd, 'Réglé par de9de9 — prestataire payé, marqué « Transféré ».', 'de9');
      break;
    default:
      return noNext();
  }

  return { data: { ...worklistDetailOf(cmd), newId: null } };
};

/** Mock devis ids are `<commandeId>:devis:<index>` — resolve one back to its commande and devis. */
function findDevis(devisId: string) {
  const at = devisId.lastIndexOf(':devis:');
  if (at < 0) return null;
  const cmd = cmdById(devisId.slice(0, at));
  const devis = cmd?.devis?.[Number(devisId.slice(at + ':devis:'.length))];
  return cmd && devis ? { cmd, devis } : null;
}

/**
 * POST /devis/:devisId/valider | /refuser — the same state change and journal
 * text as the mock's POST /commandes/:id/devis `valide` / `refuse`. Only a
 * received devis can be judged (409 otherwise). The live response body is
 * undocumented, so the twin answers with the updated devis row, which the
 * console doesn't read.
 */
function devisDecisionHandler(decision: 'valider' | 'refuser'): MockHandler {
  return (req) => {
    const id = req.pathParams['devisId'] ?? '';
    const found = findDevis(id);
    if (!found) return problem(404, 'Not Found', `Devis introuvable : ${id}`);
    const { cmd, devis } = found;
    if (devis.status !== 'recu') {
      return problem(409, 'Conflict', `Ce devis n'attend pas de décision (statut : ${devis.status}).`);
    }
    if (decision === 'valider') {
      devis.status = 'valide';
      addAudit(cmd, 'Devis de « ' + devis.raison + ' » validé (bon) — par de9de9.', 'de9');
    } else {
      devis.status = 'refuse';
      addAudit(cmd, 'Devis de « ' + devis.raison + ' » refusé — par de9de9.', 'de9');
    }
    const index = (cmd.devis ?? []).indexOf(devis);
    return { data: worklistDetailOf(cmd).devis?.[index] ?? null };
  };
}

export const devisValiderHandler = devisDecisionHandler('valider');
export const devisRefuserHandler = devisDecisionHandler('refuser');

/**
 * POST /appels-offres/:rfqId/devis/proposer — transmit the validated devis to
 * the client (the S3 → S4 step, refused at any other status), with the mock's
 * POST /commandes/:id/devis `propose` state change and journal text. Answers
 * with the updated detail, like the live endpoint.
 */
export const devisProposerHandler: MockHandler = (req) => {
  const id = req.pathParams['rfqId'] ?? '';
  const cmd = cmdById(id);
  if (!cmd) return problem(404, 'Not Found', `Appel d'offres introuvable : ${id}`);
  if (flowKey(cmd, projectCommande(cmd)) !== 'devis') {
    return problem(409, 'Conflict', 'Proposer au client est possible uniquement au statut S3 (en attente des devis).');
  }
  const valides = (cmd.devis ?? []).filter((d) => d.status === 'valide');
  if (!valides.length) {
    return problem(422, 'Unprocessable Content', 'Validez au moins un devis avant de le proposer au client.');
  }
  cmd.proposedToClient = true;
  addAudit(cmd, valides.length + ' devis validé(s) transmis au client — par de9de9.', 'de9');
  return { data: worklistDetailOf(cmd) };
};

/**
 * POST /commandes/worklist/:id/planifier-occurrence — V0 → V1: date the visit
 * and move it to « À confirmer », with the mock's own `plan` state change and
 * journal text. The mock db stores a day only, so the time is accepted and
 * dropped. Answers with the updated detail, like the live endpoint.
 */
export const planifierOccurrenceHandler: MockHandler = (req) => {
  const id = req.pathParams['id'] ?? '';
  const cmd = cmdById(id);
  if (!cmd) return problem(404, 'Not Found', `Ligne introuvable dans la file : ${id}`);
  const body = (req.body ?? {}) as { date?: unknown };
  const date = typeof body.date === 'string' ? body.date.trim() : '';
  if (!date) return problem(400, 'Bad Request', 'Une date est requise (ISO yyyy-mm-dd).');
  const occ = currentOcc(cmd);
  if (!occ) return problem(409, 'Conflict', 'Aucune occurrence à planifier sur cette ligne.');
  occ.date = fromISO(date);
  occ.status = 'toConfirm';
  addAudit(cmd, 'Occurrence planifiée par de9de9.', 'de9');
  return { data: worklistDetailOf(cmd) };
};

/**
 * POST /commandes/worklist/:id/affecter-ouvrier — V2 → V3: assign team members
 * to the visit by id. Mock équipe ids are 'w<index>' over db.workers (see the
 * /companies/:companyId/equipe route), so they resolve back to the names the
 * mock occurrence stores, joined like the live rows ('Sofiane M., Nadia R.').
 */
export const affecterOuvrierHandler: MockHandler = (req) => {
  const id = req.pathParams['id'] ?? '';
  const cmd = cmdById(id);
  if (!cmd) return problem(404, 'Not Found', `Ligne introuvable dans la file : ${id}`);
  const body = (req.body ?? {}) as { teamMemberIds?: unknown };
  const ids = Array.isArray(body.teamMemberIds)
    ? body.teamMemberIds.filter((x): x is string => typeof x === 'string')
    : [];
  if (!ids.length) return problem(400, 'Bad Request', 'Au moins un « teamMemberIds » est requis.');
  const occ = currentOcc(cmd);
  if (!occ) return problem(409, 'Conflict', 'Aucune occurrence à affecter sur cette ligne.');
  const names = ids.map((memberId) => db.workers[Number(memberId.replace(/\D/g, ''))] ?? memberId);
  occ.ouvrier = names.join(', ');
  occ.status = 'confirmedAssigned';
  addAudit(cmd, 'Ouvrier ' + names.join(', ') + ' affecté pour le prestataire.', 'pro');
  return { data: worklistDetailOf(cmd) };
};

/**
 * POST /commandes/worklist/:id/deposer-facture — V4 → V5: the invoice upload.
 * Reads the multipart body (`files`, or a single `file` part, plus an optional
 * JSON `payload`) and records the mock facture, with the same state change and
 * journal text as the mock's `deposit` action. `montantCredits` and `montant`
 * are both accepted in the payload, since the live field name is unverified.
 */
export const deposerFactureHandler: MockHandler = (req) => {
  const id = req.pathParams['id'] ?? '';
  const cmd = cmdById(id);
  if (!cmd) return problem(404, 'Not Found', `Ligne introuvable dans la file : ${id}`);
  if (!(req.body instanceof FormData)) {
    return problem(400, 'Bad Request', 'Corps multipart/form-data attendu (files + payload).');
  }
  const files = req.body.getAll('files').filter((f): f is File => typeof f !== 'string');
  const single = req.body.get('file');
  if (single instanceof File) files.push(single);
  if (!files.length) return problem(400, 'Bad Request', 'Au moins un fichier est requis.');

  let montant = 0;
  let note = '';
  const rawPayload = req.body.get('payload');
  if (typeof rawPayload === 'string' && rawPayload.trim()) {
    try {
      const payload = JSON.parse(rawPayload) as { montantCredits?: unknown; montant?: unknown; note?: unknown };
      const amount = payload.montantCredits ?? payload.montant;
      montant = typeof amount === 'number' ? amount : 0;
      note = typeof payload.note === 'string' ? payload.note : '';
    } catch {
      return problem(400, 'Bad Request', 'La partie « payload » doit être un JSON valide.');
    }
  }

  const occ = currentOcc(cmd);
  if (!occ) return problem(409, 'Conflict', 'Aucune occurrence à facturer sur cette ligne.');
  const fileName = files[0]?.name ?? 'facture.pdf';
  occ.facture = { montant, deposee: true, transfere: false, fileName, note };
  occ.status = 'doneInvoiced';
  addAudit(
    cmd,
    'Facture déposée pour le prestataire (' + fileName + ', ' + montant.toLocaleString('fr-FR') + ' cr).',
    'pro',
  );
  return { data: worklistDetailOf(cmd) };
};
