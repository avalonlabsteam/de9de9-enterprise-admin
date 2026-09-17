// Mock API route table — business mutations ported verbatim from the prototype
// (src/admin/logic.ts: act/agir dispatch, confirmApprove, confirmReprogram,
// confirmAssign, confirmDeposit, confirmChoose, addNote, toggleHandled,
// submitReview, confirmRecharge, proposeDevis, chooseDevis, devisAct,
// confirmSalarie, kycOf/addKycDoc/removeKycDoc/logKyc).
// Audit texts are stored in French (handlers are not language-aware).
import type { ZodError } from 'zod';
import { passthrough, register } from './router';
import type { MockResponse } from './router';
import { commandeDetailOf } from './commandeDetail';
import { worklistHandler, worklistKpisHandler } from './worklist';
import { demanderDevisHandler } from './demandeDevis';
import {
  devisProposerHandler,
  devisRefuserHandler,
  devisValiderHandler,
  affecterOuvrierHandler,
  choisirPrestataireHandler,
  deposerFactureHandler,
  planifierOccurrenceHandler,
  worklistDetailHandler,
  worklistNextActionHandler,
  worklistNotesHandler,
  worklistAddNoteHandler,
  worklistDeleteNoteHandler,
  worklistTraiteHandler,
} from './worklistDetail';
import { prestatairesRechercheHandler } from './prestatairesRecherche';
import { prestataireFicheHandler } from './prestataireFiche';
import {
  db,
  subAudit,
  analyticsSeed,
  cmdById,
  addAudit,
  currentOcc,
  kycOf,
  logKyc,
  nowStamp,
  fromISO,
  toISO,
  facturesFromCommandes,
} from './db';
import {
  commandeActionInputSchema,
  devisActionInputSchema,
  noteInputSchema,
} from '@/features/commandes/schemas/commande';
import type { Commande, Occurrence } from '@/features/commandes/schemas/commande';
import { reviewInputSchema } from '@/features/prestataires/schemas/review';
import type { Review } from '@/features/prestataires/schemas/review';
import { kycDocInputSchema } from '@/features/prestataires/schemas/prestataire';
import { rechargeInputSchema } from '@/features/credits/schemas/credit';
import type { CreditEntry, CreditLedgerItem } from '@/features/credits/schemas/credit';
import { salarieInputSchema } from '@/features/soustraitance/schemas/sub';
import type { HandicapItem } from '@/features/handicap/schemas/handicap';
import type { FactureConsoleItem } from '@/features/factures/schemas/facture';

// ---------- response helpers ----------
const badRequest = (error: ZodError): MockResponse => ({
  status: 400,
  data: {
    message: error.issues
      .map((i) => (i.path.length ? i.path.join('.') + ': ' : '') + i.message)
      .join(' · '),
  },
});

const notFound = (message: string): MockResponse => ({ status: 404, data: { message } });

const ok = (data: unknown): MockResponse => ({ data });

/** Resolve the target occurrence: explicit occId, else the current actionable one. */
function resolveOcc(cmd: Commande, occId?: string): Occurrence | null {
  if (occId) return cmd.occurrences.find((o) => o.id === occId) ?? null;
  return currentOcc(cmd);
}

// ===================== commandes =====================
register('GET', '/commandes', () => ok(db.commandes));

// Integrated with the real API — served by the network, not the mock. Comment
// this line out to fall back to the mock worklist (offline dev).
passthrough('GET', '/commandes/worklist');

// Must be registered before '/commandes/:id' — routes match in registration
// order, and ':id' would otherwise capture the literal segment 'worklist'.
register('GET', '/commandes/worklist', worklistHandler);

// Integrated with the real API — served by the network, not the mock. Comment
// this line out to fall back to the mock KPIs below (offline dev).
passthrough('GET', '/commandes/worklist/kpis');

// Must be registered before '/commandes/worklist/:id' — routes match in
// registration order, and ':id' would otherwise capture the segment 'kpis'.
register('GET', '/commandes/worklist/kpis', worklistKpisHandler);

// Integrated with the real API — served by the network, not the mock. Comment
// this line out to fall back to the mock detail below (offline dev).
passthrough('GET', '/commandes/worklist/:id');

register('GET', '/commandes/worklist/:id', worklistDetailHandler);

// Integrated with the real API — served by the network, not the mock. Comment
// this line out to fall back to the mock below, which advances mock rows.
passthrough('POST', '/commandes/worklist/:id/next-action');

register('POST', '/commandes/worklist/:id/next-action', worklistNextActionHandler);

// V0 → V1 of the visit roadmap, on its own route rather than /commandes/:id/actions.
passthrough('POST', '/commandes/worklist/:id/planifier-occurrence');

register('POST', '/commandes/worklist/:id/planifier-occurrence', planifierOccurrenceHandler);

// V2 → V3 of the visit roadmap, by team-member id.
passthrough('POST', '/commandes/worklist/:id/affecter-ouvrier');

register('POST', '/commandes/worklist/:id/affecter-ouvrier', affecterOuvrierHandler);

// V4 → V5 of the visit roadmap — the invoice upload (multipart).
passthrough('POST', '/commandes/worklist/:id/deposer-facture');

register('POST', '/commandes/worklist/:id/deposer-facture', deposerFactureHandler);

// S4 → V1 — the client retains one of the devis transmitted to them. The route
// is the one the payload's nextAction.route names, not /commandes/:id/actions.
passthrough('POST', '/commandes/worklist/:id/choisir-prestataire');

register('POST', '/commandes/worklist/:id/choisir-prestataire', choisirPrestataireHandler);

// ===================== notes + traité on a worklist row =====================
// Integrated with the real API — served by the network, not the mock. Comment
// these out to fall back to the twins below (offline dev).
passthrough('GET', '/commandes/worklist/:id/notes');
passthrough('POST', '/commandes/worklist/:id/notes');
passthrough('DELETE', '/commandes/worklist/:id/notes/:noteId');
passthrough('PATCH', '/commandes/worklist/:id/traite');

register('GET', '/commandes/worklist/:id/notes', worklistNotesHandler);
register('POST', '/commandes/worklist/:id/notes', worklistAddNoteHandler);
register('DELETE', '/commandes/worklist/:id/notes/:noteId', worklistDeleteNoteHandler);
register('PATCH', '/commandes/worklist/:id/traite', worklistTraiteHandler);

// ===================== devis =====================
// Integrated with the real API — served by the network, not the mock. Comment
// these lines out to fall back to the mock twins below (offline dev).
passthrough('POST', '/devis/:devisId/valider');
passthrough('POST', '/devis/:devisId/refuser');

register('POST', '/devis/:devisId/valider', devisValiderHandler);
register('POST', '/devis/:devisId/refuser', devisRefuserHandler);

// Integrated with the real API — comment out to fall back to the mock twin.
passthrough('POST', '/appels-offres/:rfqId/devis/proposer');

register('POST', '/appels-offres/:rfqId/devis/proposer', devisProposerHandler);

// Integrated with the real API — comment out to fall back to the mock twin,
// which records the brief on the appel d'offres and opens its devis (S2 → S3).
passthrough('POST', '/appels-offres/:rfqId/demander-devis');

register('POST', '/appels-offres/:rfqId/demander-devis', demanderDevisHandler);

// NOT passed through — the live endpoint is keyed by CONTRACT id, and no id the
// worklist hands us is one. Its rows are `kind: 'rfq'` (appels d'offres, S1–S3,
// reference D-xxxxxx) or `kind: 'visite'` (V0–V6, reference C-xxxx); a contract
// is the S4 entity that an accepted devis produces, and passing anything else
// answers 404 { title: 'Contract not found', code: 'not_found' }. Turning this on
// therefore 404s every console open — it needs a contract-id lookup (or per-kind
// detail endpoints) first. `useCommandeDetail` already matches the contract
// payload; it is the mock below that serves it until then.
//   passthrough('GET', '/commandes/:id');

// One payload, both shapes: the legacy console commande (occurrences, devis,
// notes, brief) merged with the projection envelope the real endpoint answers.
// Zod strips what each schema doesn't declare, so `useCommande` and
// `useCommandeDetail` both parse it.
register('GET', '/commandes/:id', (req) => {
  const cmd = cmdById(req.pathParams['id'] ?? '');
  if (!cmd) return notFound(`Commande introuvable : ${req.pathParams['id']}`);
  return ok({ ...cmd, ...commandeDetailOf(cmd) });
});

/** A real backend id (UUID), as opposed to a mock one like 'C-2041' or a mock company name. */
const isLiveId = (id: string | undefined): boolean =>
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id ?? '');

// Not passed through: every visit roadmap step moved to its own
// /commandes/worklist/:id/… route, so this one now serves the mock console only.

// POST /commandes/:id/actions — the act/agir dispatch + modal confirms
register('POST', '/commandes/:id/actions', (req) => {
  const cmd = cmdById(req.pathParams['id'] ?? '');
  if (!cmd) return notFound(`Commande introuvable : ${req.pathParams['id']}`);

  const parsed = commandeActionInputSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(parsed.error);
  const input = parsed.data;

  switch (input.kind) {
    case 'callClient': {
      cmd.setup = 'contacte';
      addAudit(cmd, 'Client appelé — fait par de9de9.', 'de9');
      break;
    }
    case 'addQuote': {
      const names = ['ProServ', 'TechniPlus', 'AlgServ', 'BatiPro'];
      const n = names[cmd.quotes.length % names.length] ?? 'ProServ';
      cmd.quotes.push({
        raison: n,
        montant: 9000 + cmd.quotes.length * 3000,
        delai: 2 + cmd.quotes.length + ' j',
        note: 'Devis saisi par de9de9',
        chosen: false,
      });
      addAudit(cmd, 'Devis « ' + n + ' » saisi pour le prestataire.', 'pro');
      break;
    }
    case 'choose': {
      const qi = input.quoteIndex;
      const chosen = cmd.quotes[qi];
      if (!chosen) return { status: 400, data: { message: 'Sélectionnez un candidat' } };
      cmd.quotes.forEach((q, i) => {
        q.chosen = i === qi;
      });
      cmd.setup = 'assigne';
      cmd.prestataire = { name: chosen.raison, phone: '0560000000' };
      if (!cmd.occurrences.length) {
        cmd.occurrences = [{ id: 'o1', date: '05/07/2026', status: 'toConfirm', ouvrier: null, facture: null }];
      }
      addAudit(cmd, 'Prestataire « ' + cmd.prestataire.name + ' » choisi pour le client.', 'client');
      break;
    }
    case 'plan': {
      const occ = resolveOcc(cmd, input.occId);
      if (!occ) return notFound('Occurrence introuvable');
      occ.status = 'toConfirm';
      addAudit(cmd, 'Occurrence planifiée par de9de9.', 'de9');
      break;
    }
    case 'confirmVisit': {
      const occ = resolveOcc(cmd, input.occId);
      if (!occ) return notFound('Occurrence introuvable');
      occ.status = 'confirmed';
      addAudit(cmd, 'Visite confirmée au nom du client (accord tél.).', 'client');
      break;
    }
    case 'assign': {
      const occ = resolveOcc(cmd, input.occId);
      if (!occ) return notFound('Occurrence introuvable');
      occ.ouvrier = input.worker;
      occ.status = 'confirmedAssigned';
      addAudit(cmd, 'Ouvrier ' + input.worker + ' affecté pour le prestataire.', 'pro');
      break;
    }
    case 'realize': {
      const occ = resolveOcc(cmd, input.occId);
      if (!occ) return notFound('Occurrence introuvable');
      occ.status = 'doneNoInvoice';
      addAudit(cmd, 'Visite marquée réalisée par de9de9.', 'de9');
      break;
    }
    case 'deposit': {
      const occ = resolveOcc(cmd, input.occId);
      if (!occ) return notFound('Occurrence introuvable');
      occ.facture = {
        montant: input.montant || 0,
        deposee: true,
        transfere: false,
        fileName: input.fileName || 'facture-' + occ.id + '.pdf',
        note: input.note ?? '',
      };
      occ.status = 'doneInvoiced';
      addAudit(
        cmd,
        'Facture déposée pour le prestataire (' +
          (input.fileName || 'fichier') +
          ', ' +
          (input.montant || 0).toLocaleString('fr-FR') +
          ' cr).',
        'pro',
      );
      break;
    }
    case 'approve': {
      const occ = resolveOcc(cmd, input.occId);
      if (!occ) return notFound('Occurrence introuvable');
      occ.status = 'doneApproved';
      addAudit(
        cmd,
        'Facture approuvée au nom du client (accord téléphonique). Engage les crédits du client.',
        'client',
      );
      break;
    }
    case 'contest': {
      const occ = resolveOcc(cmd, input.occId);
      if (!occ) return notFound('Occurrence introuvable');
      occ.status = 'doneDisputed';
      addAudit(cmd, 'Facture contestée au nom du client.', 'client');
      break;
    }
    case 'resolve': {
      const occ = resolveOcc(cmd, input.occId);
      if (!occ) return notFound('Occurrence introuvable');
      occ.status = 'doneInvoiced';
      addAudit(cmd, 'Litige résolu par de9de9 — facture rétablie.', 'de9');
      break;
    }
    case 'settle': {
      const occ = resolveOcc(cmd, input.occId);
      if (!occ) return notFound('Occurrence introuvable');
      occ.status = 'paid';
      if (occ.facture) occ.facture.transfere = true;
      addAudit(cmd, 'Réglé par de9de9 — prestataire payé, marqué « Transféré ».', 'de9');
      break;
    }
    case 'reprogram': {
      const occ = resolveOcc(cmd, input.occId);
      if (!occ) return notFound('Occurrence introuvable');
      const nd = fromISO(input.date);
      occ.date = nd;
      occ.ouvrier = null;
      occ.status = 'toConfirm';
      addAudit(
        cmd,
        'Occurrence reprogrammée au ' +
          nd +
          (input.time ? ' à ' + input.time : '') +
          ' — par de9de9. Client à reconfirmer.',
        'de9',
      );
      break;
    }
    case 'cancelOcc': {
      const occ = resolveOcc(cmd, input.occId);
      if (!occ) return notFound('Occurrence introuvable');
      occ.status = 'cancelled';
      addAudit(cmd, 'Occurrence annulée par de9de9.', 'de9');
      break;
    }
    case 'addOcc': {
      const n = cmd.occurrences.length + 1;
      cmd.occurrences.push({ id: 'o' + n, date: 10 + n + '/08/2026', status: 'added', ouvrier: null, facture: null });
      addAudit(cmd, 'Occurrence ajoutée par de9de9.', 'de9');
      break;
    }
  }

  return ok({ commande: cmd });
});

// POST /commandes/:id/devis — proposeDevis / chooseDevis / devisAct
register('POST', '/commandes/:id/devis', (req) => {
  const cmd = cmdById(req.pathParams['id'] ?? '');
  if (!cmd) return notFound(`Commande introuvable : ${req.pathParams['id']}`);

  const parsed = devisActionInputSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(parsed.error);
  const input = parsed.data;
  const devis = cmd.devis ?? [];

  if (input.action === 'propose') {
    const valides = devis.filter((d) => d.status === 'valide');
    if (!valides.length) return { status: 400, data: { message: 'Validez au moins un devis' } };
    cmd.proposedToClient = true;
    addAudit(cmd, valides.length + ' devis validé(s) transmis au client — par de9de9.', 'de9');
    return ok({ commande: cmd });
  }

  const d = devis[input.quoteIndex];
  if (!d) return notFound('Devis introuvable');

  switch (input.action) {
    case 'choose': {
      devis.forEach((x) => {
        x.chosen = x.presId === d.presId;
      });
      cmd.setup = 'assigne';
      cmd.prestataire = { name: d.raison, phone: d.phone };
      if (!cmd.occurrences.length) {
        cmd.occurrences = [{ id: 'o1', date: '05/07/2026', status: 'toConfirm', ouvrier: null, facture: null }];
      }
      addAudit(cmd, 'Devis « ' + d.raison + ' » choisi par le client — la commande passe Assigné.', 'client');
      break;
    }
    case 'valide': {
      // Only a received devis can be judged — mirrors the live routes, and keeps
      // the « non-attente implies a real montant » invariant the worklist twin
      // relies on (an 'attente' devis is seeded with montant 0).
      if (d.status !== 'recu') return { status: 409, data: { message: "Ce devis n'attend pas de décision" } };
      d.status = 'valide';
      addAudit(cmd, 'Devis de « ' + d.raison + ' » validé (bon) — par de9de9.', 'de9');
      break;
    }
    case 'refuse': {
      if (d.status !== 'recu') return { status: 409, data: { message: "Ce devis n'attend pas de décision" } };
      d.status = 'refuse';
      addAudit(cmd, 'Devis de « ' + d.raison + ' » refusé — par de9de9.', 'de9');
      break;
    }
    case 'simReceive': {
      const presets: Record<string, [number, string]> = { p4: [12000, '3 j'], p12: [14500, '2 j'], p9: [11000, '4 j'] };
      const idx = devis.indexOf(d);
      const base = presets[d.presId] ?? [9000 + idx * 2500, 2 + idx + ' j'];
      d.status = 'recu';
      d.montant = d.montant || base[0];
      d.delai = d.delai || base[1];
      d.details = d.details || 'Intervention complète, matériel et déplacement inclus. Garantie 3 mois.';
      d.docName = d.docName || 'devis-' + d.raison.toLowerCase() + '-' + cmd.id + '.pdf';
      addAudit(cmd, 'Devis reçu de « ' + d.raison + ' ».', 'pro');
      break;
    }
    case 'devalider': {
      if (d.status !== 'valide') return { status: 409, data: { message: "Ce devis n'est pas validé" } };
      d.status = 'recu';
      addAudit(cmd, 'Validation du devis « ' + d.raison + ' » retirée.', 'de9');
      break;
    }
  }

  return ok({ commande: cmd });
});

// POST /commandes/:id/notes — addNote (author 'Vous', appended)
register('POST', '/commandes/:id/notes', (req) => {
  const cmd = cmdById(req.pathParams['id'] ?? '');
  if (!cmd) return notFound(`Commande introuvable : ${req.pathParams['id']}`);

  const parsed = noteInputSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(parsed.error);
  const text = parsed.data.text.trim();
  if (!text) return { status: 400, data: { message: 'Le texte de la note est vide' } };

  cmd.notes = [...cmd.notes, { author: 'Vous', text, date: nowStamp(), handled: false }];
  return ok({ commande: cmd });
});

// POST /commandes/:id/notes/:index/handled — toggleHandled
register('POST', '/commandes/:id/notes/:index/handled', (req) => {
  const cmd = cmdById(req.pathParams['id'] ?? '');
  if (!cmd) return notFound(`Commande introuvable : ${req.pathParams['id']}`);

  const index = Number.parseInt(req.pathParams['index'] ?? '', 10);
  const note = Number.isInteger(index) ? cmd.notes[index] : undefined;
  if (!note) return notFound(`Note introuvable : index ${req.pathParams['index']}`);

  note.handled = !note.handled;
  return ok({ commande: cmd });
});

// ===================== companies =====================
// The prestataire's team for « Affecter un ouvrier ». Real company UUIDs go to
// the network; mock companies (named after the prestataire) get the mock
// workers, in the dossier's équipe shape.
passthrough('GET', '/companies/:companyId/equipe', ({ companyId }) => isLiveId(companyId));

register('GET', '/companies/:companyId/equipe', () =>
  ok(db.workers.map((fullName, i) => ({ id: 'w' + i, fullName, role: null }))),
);

// ===================== prestataires =====================
register('GET', '/prestataires', () => ok(db.prestataires));

// Integrated with the real API — served by the network, not the mock. Comment
// this line out to fall back to the mock recherche (offline dev).
passthrough('GET', '/prestataires/recherche');

// Must be registered before '/prestataires/:id' — routes match in registration
// order, and ':id' would otherwise capture the literal segment 'recherche'.
register('GET', '/prestataires/recherche', prestatairesRechercheHandler);

// Integrated with the real API — served by the network, not the mock. Comment
// this line out to fall back to the mock fiche below (offline dev). The path
// segment is a COMPANY id; the mock also accepts a mock prestataire id or name.
passthrough('GET', '/prestataires/:companyId');

// The composite profile payload (fiche + avis + dossier) — the only
// '/prestataires/:x' route now: the flat mock Prestataire it replaced lost its
// last consumer when the profile overlay moved onto this payload.
register('GET', '/prestataires/:companyId', prestataireFicheHandler);

// ===================== reviews =====================
register('GET', '/reviews', (req) => {
  const presId = req.query['presId'];
  return ok(presId ? db.reviews.filter((r) => r.presId === presId) : db.reviews);
});

// POST /reviews — submitReview (source de9de9, prepended)
register('POST', '/reviews', (req) => {
  const parsed = reviewInputSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(parsed.error);
  const input = parsed.data;

  const comment = input.comment.trim();
  if (!comment) return { status: 400, data: { message: 'Le commentaire est obligatoire' } };

  const rev: Review = {
    id: 'r' + Date.now(),
    presId: input.presId,
    source: 'de9de9',
    auteur: 'de9de9 · Karim',
    cmd: input.cmd ?? '',
    occ: input.occ ?? '',
    service: input.service ?? '',
    note: input.note,
    comment,
    date: '27/06/2026',
  };
  db.reviews = [rev, ...db.reviews];

  if (input.cmd) {
    const cmd = cmdById(input.cmd);
    if (cmd) {
      const presName =
        input.presName ?? db.prestataires.find((p) => p.id === input.presId)?.name ?? input.presId;
      addAudit(cmd, 'Avis de9de9 ajouté sur ' + presName + ' (' + input.note + '★).', 'de9');
    }
  }

  return ok(rev);
});

// ===================== credits =====================
// Integrated with the real API — served by the network. The mock below is the
// offline fallback: same meta/data envelope, rows mapped from the legacy db
// seed shape (id from ref, occurredAt from the dd/mm/yyyy date).
passthrough('GET', '/credits');

register('GET', '/credits', (req) => {
  const q = req.query;
  let list = db.credits.slice();
  const search = (q['Q'] ?? '').trim().toLowerCase();
  if (search) {
    const qc = search.replace(/\s/g, '');
    list = list.filter(
      (e) =>
        e.client.toLowerCase().includes(search) ||
        e.email.toLowerCase().includes(search) ||
        e.phone.replace(/\s/g, '').includes(qc),
    );
  }
  if (q['Type']) list = list.filter((e) => e.type === q['Type']);

  const pageSize = Math.max(1, Number(q['PageSize']) || 25);
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const page = Math.min(Math.max(1, Number(q['Page']) || 1), totalPages);
  const data: CreditLedgerItem[] = list.slice((page - 1) * pageSize, page * pageSize).map((e) => ({
    ...e,
    id: e.ref,
    justif: e.justif ?? null,
    facture: e.facture ?? null,
    invoiceId: null,
    occurredAt: toISO(e.date) ? toISO(e.date) + 'T00:00:00Z' : new Date().toISOString(),
  }));
  return ok({
    meta: {
      current_page: page,
      per_page: pageSize,
      total: list.length,
      total_pages: totalPages,
      has_more_pages: page < totalPages,
    },
    data,
  });
});

// POST /recharges — confirmRecharge (create mode, row prepended)
register('POST', '/recharges', (req) => {
  const parsed = rechargeInputSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(parsed.error);
  const input = parsed.data;

  const ref = 'REC-' + Math.floor(8850 + Math.random() * 140);
  const today = new Date().toLocaleDateString('fr-FR');
  const credit: CreditEntry = {
    date: today,
    type: 'rech',
    client: input.client || 'Client',
    benef: '—',
    ref,
    credits: input.montant || 0,
    solde: '—',
    email: '',
    phone: '',
    cmdRef: '',
    justif: input.justif ?? null,
    facture: input.facture ?? null,
  };
  db.credits = [credit, ...db.credits];
  return ok({ credit });
});

// ===================== factures =====================
// Recomputed from occurrence factures so mutations (deposit/settle/…) show up.
// The 85/15 split stays arithmetic on the client (montant*0.85 / montant*0.15),
// exactly as the prototype computes it for display.
register('GET', '/factures', () => {
  db.factures = facturesFromCommandes(db.commandes);
  return ok(db.factures);
});

// Integrated with the real API — served by the network. The mock below is the
// offline fallback, deriving console rows from the commandes' deposited
// factures (Du/Au/ClientId/PrestataireId are not implemented: the UI never
// sends them yet).
passthrough('GET', '/factures/console');

register('GET', '/factures/console', (req) => {
  const q = req.query;
  /** 'dd/mm/yyyy' → sortable number (logic.ts toNum). */
  const toNum = (d: string): number => {
    const p = d.split('/');
    return p.length === 3 ? Number(p[2]) * 10000 + Number(p[1]) * 100 + Number(p[0]) : 0;
  };
  let list = facturesFromCommandes(db.commandes).sort((a, b) => toNum(b.date) - toNum(a.date));

  const search = (q['Q'] ?? '').trim().toLowerCase();
  if (search) {
    const qc = search.replace(/\s/g, '');
    list = list.filter(
      (f) =>
        f.client.toLowerCase().includes(search) ||
        f.email.toLowerCase().includes(search) ||
        f.contact.toLowerCase().replace(/\s/g, '').includes(qc),
    );
  }
  if (q['Statut']) list = list.filter((f) => f.status === q['Statut']);
  if (q['MontantMin']) list = list.filter((f) => f.montant >= Number(q['MontantMin']));
  if (q['MontantMax']) list = list.filter((f) => f.montant <= Number(q['MontantMax']));

  const pageSize = Math.max(1, Number(q['PageSize']) || 20);
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const page = Math.min(Math.max(1, Number(q['Page']) || 1), totalPages);
  const data: FactureConsoleItem[] = list.slice((page - 1) * pageSize, page * pageSize).map((f) => ({
    ...f,
    invoiceId: f.cmdId + '-' + f.occId,
    cmdRef: f.cmdId,
    createdAt: new Date().toISOString(), // not tracked in the mock db
  }));
  return ok({
    meta: {
      current_page: page,
      per_page: pageSize,
      total: list.length,
      total_pages: totalPages,
      has_more_pages: page < totalPages,
    },
    data,
  });
});

// ===================== sous-traitance =====================
register('GET', '/sub/demandes', () => ok(db.subDemandes));

register('GET', '/sub/pros', () => ok(db.subPros));

// POST /sub/salaries — confirmSalarie (prepend to the sub audit trail)
register('POST', '/sub/salaries', (req) => {
  const parsed = salarieInputSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(parsed.error);
  const input = parsed.data;

  subAudit.unshift({ pro: input.proName, entreprise: input.entreprise, who: 'Karim', date: nowStamp() });
  return ok({ ok: true });
});

// ===================== handicap waitlist =====================
// Integrated with the real API — served by the network. The mock below is the
// offline fallback: it maps the legacy db seed shape onto the API's meta/data
// page envelope.
passthrough('GET', '/handicap');

register('GET', '/handicap', (req) => {
  const q = req.query;
  let list = db.handicap.slice();
  const search = (q['search'] ?? '').trim().toLowerCase();
  if (search) {
    list = list.filter(
      (w) =>
        w.entreprise.toLowerCase().includes(search) ||
        w.poste.toLowerCase().includes(search) ||
        w.zone.toLowerCase().includes(search),
    );
  }
  if (q['wilaya']) list = list.filter((w) => w.zone === q['wilaya']);
  if (q['jobType']) list = list.filter((w) => w.poste === q['jobType']);
  if (q['contacted']) list = list.filter((w) => String(w.contacted) === q['contacted']);

  const pageSize = Math.max(1, Number(q['pageSize']) || 20);
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const page = Math.min(Math.max(1, Number(q['page']) || 1), totalPages);
  const items: HandicapItem[] = list.slice((page - 1) * pageSize, page * pageSize).map((w) => ({
    id: w.id,
    companyName: w.entreprise,
    contactName: w.contact,
    contactPhone: w.phone,
    contactEmail: null,
    jobType: w.poste,
    positionsCount: w.nombre,
    wilaya: w.zone,
    commune: null,
    comment: w.commentaire,
    isContacted: w.contacted,
    contactedAt: null,
    contactNote: null,
    registeredAt: toISO(w.date),
    updatedAt: null,
  }));
  return ok({
    meta: {
      current_page: page,
      per_page: pageSize,
      total: list.length,
      total_pages: totalPages,
      has_more_pages: page < totalPages,
    },
    data: items,
  });
});

// ===================== analytics =====================
// The prototype's buildAnalytics is a static seed — `?period=` only drives the
// chip highlight client-side, so it is accepted but does not change the data.
// Integrated with the real API — served by the network; the seed below stays
// as the offline fallback (its 0–100 bar values normalize like real amounts).
passthrough('GET', '/analytics');
register('GET', '/analytics', () => ok(analyticsSeed));

// Real-only: no mock twin — the platform overview section hides when this 404s.
passthrough('GET', '/admin/dashboard');

// ===================== KYC =====================
register('GET', '/kyc/:key', (req) => ok(kycOf(req.pathParams['key'] ?? '')));

// POST /kyc/:key/docs — addKycDoc (+ journal entry)
register('POST', '/kyc/:key/docs', (req) => {
  const key = req.pathParams['key'] ?? '';
  const parsed = kycDocInputSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(parsed.error);
  const input = parsed.data;

  const state = kycOf(key);
  state.docs = [...state.docs, { id: 'doc' + Date.now(), label: input.label, name: input.fileName }];
  logKyc(key, 'Ajout document · ' + input.fileName);
  return ok(state);
});

// DELETE /kyc/:key/docs/:docId — removeKycDoc (+ journal entry)
register('DELETE', '/kyc/:key/docs/:docId', (req) => {
  const key = req.pathParams['key'] ?? '';
  const docId = req.pathParams['docId'] ?? '';
  const state = kycOf(key);

  const doc = state.docs.find((x) => x.id === docId);
  if (!doc) return notFound(`Document introuvable : ${docId}`);

  state.docs = state.docs.filter((x) => x.id !== docId);
  logKyc(key, 'Suppression document · ' + doc.label);
  return ok(state);
});

// ===================== misc =====================
// ===================== geo dictionaries =====================
// Integrated with the real API (public endpoints). The mock below is the
// offline fallback: it derives its dictionaries from the mock commandes, so
// codes are positional and nomAr falls back to nom.
passthrough('GET', '/geo/wilayas');
passthrough('GET', '/geo/wilayas/:code/communes');

function mockWilayas(): { code: number; nom: string; nomAr: string; nombreCommunes: number }[] {
  const names = [...new Set(db.commandes.map((c) => c.wilaya))].sort((a, b) => a.localeCompare(b, 'fr'));
  return names.map((nom, i) => ({
    code: i + 1,
    nom,
    nomAr: nom,
    nombreCommunes: new Set(db.commandes.filter((c) => c.wilaya === nom).map((c) => c.commune)).size,
  }));
}

register('GET', '/geo/wilayas', () => ok(mockWilayas()));

register('GET', '/geo/wilayas/:code/communes', (req) => {
  const wilaya = mockWilayas().find((w) => w.code === Number(req.pathParams['code']));
  if (!wilaya) return notFound(`Wilaya introuvable : ${req.pathParams['code']}`);
  const communes = [...new Set(db.commandes.filter((c) => c.wilaya === wilaya.nom).map((c) => c.commune))]
    .sort((a, b) => a.localeCompare(b, 'fr'))
    .map((nom, i) => ({ code: i + 1, nom, nomAr: nom }));
  return ok(communes);
});

register('GET', '/health', () => ok({ ok: true }));
