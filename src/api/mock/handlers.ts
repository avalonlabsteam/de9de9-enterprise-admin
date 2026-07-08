// Mock API route table — business mutations ported verbatim from the prototype
// (src/admin/logic.ts: act/agir dispatch, confirmApprove, confirmReprogram,
// confirmAssign, confirmDeposit, confirmChoose, addNote, toggleHandled,
// submitReview, confirmRecharge, proposeDevis, chooseDevis, devisAct,
// confirmSalarie, kycOf/addKycDoc/removeKycDoc/logKyc).
// Audit texts are stored in French (handlers are not language-aware).
import type { ZodError } from 'zod';
import { register } from './router';
import type { MockResponse } from './router';
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
import type { CreditEntry } from '@/features/credits/schemas/credit';
import { salarieInputSchema } from '@/features/soustraitance/schemas/sub';

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

register('GET', '/commandes/:id', (req) => {
  const cmd = cmdById(req.pathParams['id'] ?? '');
  if (!cmd) return notFound(`Commande introuvable : ${req.pathParams['id']}`);
  return ok(cmd);
});

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
      d.status = 'valide';
      addAudit(cmd, 'Devis de « ' + d.raison + ' » validé (bon) — par de9de9.', 'de9');
      break;
    }
    case 'refuse': {
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

// ===================== prestataires =====================
register('GET', '/prestataires', () => ok(db.prestataires));

register('GET', '/prestataires/:id', (req) => {
  const pres = db.prestataires.find((p) => p.id === req.pathParams['id']);
  if (!pres) return notFound(`Prestataire introuvable : ${req.pathParams['id']}`);
  return ok(pres);
});

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
register('GET', '/credits', () => ok(db.credits));

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
register('GET', '/handicap', () => ok(db.handicap));

// ===================== analytics =====================
// The prototype's buildAnalytics is a static seed — `?period=` only drives the
// chip highlight client-side, so it is accepted but does not change the data.
register('GET', '/analytics', () => ok(analyticsSeed));

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
register('GET', '/health', () => ok({ ok: true }));
