import { z } from 'zod';

// ---------- status codes (ported verbatim from src/admin/logic.ts) ----------
// Setup pipeline: S1 arappeler → S2 contacte → S3 devis → S4 assigne
export const setupStatusSchema = z.enum(['arappeler', 'contacte', 'devis', 'assigne']);
export type SetupStatus = z.infer<typeof setupStatusSchema>;

// Occurrence pipeline: V0 added → V1 toConfirm → V2 confirmed → V3 confirmedAssigned
// → V4 doneNoInvoice → V5 doneInvoiced (V5·C doneDisputed) → V6 doneApproved → V7 paid · V✕ cancelled
export const occStatusSchema = z.enum([
  'added',
  'toConfirm',
  'confirmed',
  'confirmedAssigned',
  'doneNoInvoice',
  'doneInvoiced',
  'doneDisputed',
  'doneApproved',
  'paid',
  'cancelled',
]);
export type OccStatus = z.infer<typeof occStatusSchema>;

export const ballSchema = z.enum(['client', 'pro', 'de9', 'done']);
export type Ball = z.infer<typeof ballSchema>;

export const auditRoleSchema = z.enum(['client', 'pro', 'de9', 'sys']);
export type AuditRole = z.infer<typeof auditRoleSchema>;

// ---------- audit ----------
export const auditEntrySchema = z.object({
  txt: z.string(),
  role: auditRoleSchema,
  date: z.string(),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;

// ---------- occurrence ----------
export const occFactureSchema = z.object({
  montant: z.number(),
  deposee: z.boolean(),
  transfere: z.boolean(),
  fileName: z.string().optional(),
  note: z.string().optional(),
});
export type OccFacture = z.infer<typeof occFactureSchema>;

export const occurrenceSchema = z.object({
  id: z.string(),
  date: z.string(), // dd/mm/yyyy
  status: occStatusSchema,
  ouvrier: z.string().nullable(),
  facture: occFactureSchema.nullable(),
});
export type Occurrence = z.infer<typeof occurrenceSchema>;

// ---------- quotes (legacy quick quotes list) ----------
export const quoteSchema = z.object({
  raison: z.string(),
  montant: z.number(),
  delai: z.string(),
  note: z.string(),
  chosen: z.boolean(),
});
export type Quote = z.infer<typeof quoteSchema>;

// ---------- devis (detailed quote request per prestataire) ----------
export const devisStatusSchema = z.enum(['attente', 'recu', 'valide', 'refuse']);
export type DevisStatus = z.infer<typeof devisStatusSchema>;

export const devisSchema = z.object({
  presId: z.string(),
  raison: z.string(),
  phone: z.string(),
  wa: z.string(),
  email: z.string(),
  status: devisStatusSchema,
  montant: z.number(),
  delai: z.string(),
  details: z.string(),
  docName: z.string(),
  chosen: z.boolean().optional(),
});
export type Devis = z.infer<typeof devisSchema>;

// ---------- brief ----------
export const briefFileSchema = z.object({ name: z.string() });
export type BriefFile = z.infer<typeof briefFileSchema>;

export const briefSchema = z.object({
  ref: z.string(),
  service: z.string(),
  description: z.string(),
  budgetMin: z.union([z.number(), z.string()]),
  budgetMax: z.union([z.number(), z.string()]),
  adresse: z.string(),
  commune: z.string(),
  wilaya: z.string(),
  superficie: z.union([z.number(), z.string()]),
  frequence: z.string(),
  dates: z.string(),
  contraintes: z.string(),
  photos: z.array(briefFileSchema),
  docs: z.array(briefFileSchema),
  sentAt: z.string(),
});
export type Brief = z.infer<typeof briefSchema>;

// ---------- internal notes ----------
export const noteSchema = z.object({
  author: z.string(),
  text: z.string(),
  date: z.string(),
  handled: z.boolean(),
});
export type Note = z.infer<typeof noteSchema>;

export const noteInputSchema = z.object({ text: z.string().min(1) });
export type NoteInput = z.infer<typeof noteInputSchema>;

// ---------- commande ----------
export const commandePrestataireSchema = z.object({
  name: z.string(),
  phone: z.string(),
  email: z.string().optional(),
});
export type CommandePrestataire = z.infer<typeof commandePrestataireSchema>;

export const commandeSchema = z.object({
  id: z.string(),
  client: z.string(),
  contact: z.string(),
  phone: z.string(),
  service: z.string(),
  wilaya: z.string(),
  commune: z.string(),
  clientEmail: z.string(),
  type: z.enum(['recurrent', 'ponctuel']),
  pattern: z.string(),
  setup: setupStatusSchema,
  quotes: z.array(quoteSchema),
  prestataire: commandePrestataireSchema.nullable(),
  occurrences: z.array(occurrenceSchema),
  sla: z.object({ mins: z.number() }),
  audit: z.array(auditEntrySchema),
  notes: z.array(noteSchema),
  brief: briefSchema.optional(),
  devis: z.array(devisSchema).optional(),
  proposedToClient: z.boolean().optional(),
});
export type Commande = z.infer<typeof commandeSchema>;

// ---------- action input (POST /commandes/:id/actions) ----------
// Discriminated on `kind`, mirroring the prototype's act/agir handlers.
export const commandeActionInputSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('callClient') }),
  z.object({ kind: z.literal('addQuote') }),
  z.object({ kind: z.literal('choose'), quoteIndex: z.number().int() }),
  z.object({ kind: z.literal('plan'), occId: z.string().optional() }),
  z.object({ kind: z.literal('confirmVisit'), occId: z.string().optional() }),
  z.object({ kind: z.literal('assign'), occId: z.string(), worker: z.string() }),
  z.object({ kind: z.literal('realize'), occId: z.string().optional() }),
  z.object({
    kind: z.literal('deposit'),
    occId: z.string(),
    montant: z.number(),
    fileName: z.string(),
    note: z.string().optional(),
  }),
  z.object({ kind: z.literal('approve'), occId: z.string().optional() }),
  z.object({ kind: z.literal('contest'), occId: z.string().optional() }),
  z.object({ kind: z.literal('resolve'), occId: z.string().optional() }),
  z.object({ kind: z.literal('settle'), occId: z.string().optional() }),
  z.object({
    kind: z.literal('reprogram'),
    occId: z.string(),
    date: z.string(), // ISO yyyy-mm-dd (converted with fromISO)
    time: z.string().optional(),
  }),
  z.object({ kind: z.literal('cancelOcc'), occId: z.string().optional() }),
  z.object({ kind: z.literal('addOcc') }),
]);
export type CommandeActionInput = z.infer<typeof commandeActionInputSchema>;

// ---------- devis action input (POST /commandes/:id/devis) ----------
// Mirrors proposeDevis / chooseDevis / devisAct (simReceive, valider→valide,
// refuser→refuse, devalider) from the prototype.
export const devisActionInputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('propose') }),
  z.object({ action: z.literal('choose'), quoteIndex: z.number().int() }),
  z.object({ action: z.literal('valide'), quoteIndex: z.number().int() }),
  z.object({ action: z.literal('refuse'), quoteIndex: z.number().int() }),
  z.object({ action: z.literal('simReceive'), quoteIndex: z.number().int() }),
  z.object({ action: z.literal('devalider'), quoteIndex: z.number().int() }),
]);
export type DevisActionInput = z.infer<typeof devisActionInputSchema>;
