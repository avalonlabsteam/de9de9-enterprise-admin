import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';

// ============================================================================
// Local schemas — the clients feature is self-contained (no cross-feature
// imports). Schemas are LOOSE (unknown keys are kept) so the shared TanStack
// cache entries (['commandes'], ['credits'], ['factures']) stay
// complete for the other features that read the same keys.
// ============================================================================

// ---------- commandes (subset needed by the fiche) ----------
export const ficheOccStatusSchema = z.enum([
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
export type FicheOccStatus = z.infer<typeof ficheOccStatusSchema>;

export const ficheSetupStatusSchema = z.enum(['arappeler', 'contacte', 'devis', 'assigne']);
export type FicheSetupStatus = z.infer<typeof ficheSetupStatusSchema>;

export const ficheOccurrenceSchema = z.looseObject({
  id: z.string(),
  date: z.string(), // dd/mm/yyyy
  status: ficheOccStatusSchema,
  facture: z
    .looseObject({ montant: z.number(), deposee: z.boolean(), transfere: z.boolean() })
    .nullable(),
});
export type FicheOccurrence = z.infer<typeof ficheOccurrenceSchema>;

export const ficheCommandeSchema = z.looseObject({
  id: z.string(),
  client: z.string(),
  contact: z.string(),
  phone: z.string(),
  service: z.string(),
  wilaya: z.string(),
  commune: z.string(),
  clientEmail: z.string(),
  setup: ficheSetupStatusSchema,
  prestataire: z.looseObject({ name: z.string() }).nullable(),
  occurrences: z.array(ficheOccurrenceSchema),
  devis: z
    .array(z.looseObject({ status: z.enum(['attente', 'recu', 'valide', 'refuse']) }))
    .optional(),
  proposedToClient: z.boolean().optional(),
});
export type FicheCommande = z.infer<typeof ficheCommandeSchema>;

// ---------- credits ledger ----------
export const ficheCreditSchema = z.looseObject({
  date: z.string(), // dd/mm/yyyy
  type: z.enum(['rech', 'deb', 'vers']),
  client: z.string(),
  ref: z.string(),
  credits: z.number(), // signed amount
  solde: z.string(), // formatted balance, '—' when n/a
  cmdRef: z.string(),
  justif: z.looseObject({ name: z.string() }).nullable().optional(),
  facture: z.looseObject({ name: z.string() }).nullable().optional(),
});
export type FicheCredit = z.infer<typeof ficheCreditSchema>;

// ---------- factures ----------
export const ficheFactureStatusSchema = z.enum([
  'doneInvoiced',
  'doneDisputed',
  'doneApproved',
  'paid',
]);
export type FicheFactureStatus = z.infer<typeof ficheFactureStatusSchema>;

export const ficheFactureSchema = z.looseObject({
  cmdId: z.string(),
  ref: z.string(),
  montant: z.number(),
  date: z.string(), // dd/mm/yyyy
  status: ficheFactureStatusSchema,
  client: z.string(),
  pres: z.string(),
});
export type FicheFacture = z.infer<typeof ficheFactureSchema>;

// ---------- KYC ----------
// The dossier itself is the KYC feature's (features/kyc); the fiche only names
// its three states for the header chip.
export const ficheKycStatusSchema = z.enum(['verified', 'pending', 'rejected']);
export type FicheKycStatus = z.infer<typeof ficheKycStatusSchema>;

// ============================================================================
// Query hooks (standard query keys shared with the other features)
// ============================================================================

export function useCommandes() {
  return useQuery({
    queryKey: ['commandes'],
    queryFn: async (): Promise<FicheCommande[]> => {
      const res = await apiClient.get('/commandes');
      return ficheCommandeSchema.array().parse(res.data);
    },
  });
}

export function useCredits() {
  return useQuery({
    queryKey: ['credits'],
    queryFn: async (): Promise<FicheCredit[]> => {
      // Real endpoint is paginated (meta/data envelope); the fiche filters
      // client-side, so pull one large page.
      const res = await apiClient.get('/credits', { params: { PageSize: 200 } });
      return z.object({ data: z.array(ficheCreditSchema) }).parse(res.data).data;
    },
  });
}

export function useFactures() {
  return useQuery({
    queryKey: ['factures'],
    queryFn: async (): Promise<FicheFacture[]> => {
      const res = await apiClient.get('/factures');
      return ficheFactureSchema.array().parse(res.data);
    },
  });
}
