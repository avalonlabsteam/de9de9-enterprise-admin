import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/api/apiClient';
import { queryClient } from '@/lib/queryClient';
import { t } from '@/lib/i18n';

// ============================================================================
// Local schemas — the clients feature is self-contained (no cross-feature
// imports). Schemas are LOOSE (unknown keys are kept) so the shared TanStack
// cache entries (['commandes'], ['credits'], ['factures'], ['kyc', key]) stay
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
export const ficheKycStatusSchema = z.enum(['verified', 'pending', 'rejected']);
export type FicheKycStatus = z.infer<typeof ficheKycStatusSchema>;

export const ficheKycDocSchema = z.looseObject({
  id: z.string(),
  label: z.string(),
  name: z.string(),
});
export type FicheKycDoc = z.infer<typeof ficheKycDocSchema>;

export const ficheKycAuditSchema = z.looseObject({
  who: z.string(),
  action: z.string(),
  date: z.string(),
});
export type FicheKycAuditEntry = z.infer<typeof ficheKycAuditSchema>;

export const ficheKycStateSchema = z.looseObject({
  status: ficheKycStatusSchema,
  motif: z.string(),
  docs: z.array(ficheKycDocSchema),
  audit: z.array(ficheKycAuditSchema),
});
export type FicheKycState = z.infer<typeof ficheKycStateSchema>;

export const ficheKycDocInputSchema = z.object({
  label: z.string().min(1),
  fileName: z.string().min(1),
});
export type FicheKycDocInput = z.infer<typeof ficheKycDocInputSchema>;

/** KYC key of a client fiche — logic.ts buildClientFiche ('client:' + name). */
export const clientKycKey = (name: string): string => 'client:' + name;

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
      const res = await apiClient.get('/credits');
      return ficheCreditSchema.array().parse(res.data);
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

/** GET /kyc/client::name — logic.ts kycOf('client:' + name). */
export function useClientKyc(name: string) {
  const key = clientKycKey(name);
  return useQuery({
    queryKey: ['kyc', key],
    enabled: !!name,
    queryFn: async (): Promise<FicheKycState> => {
      const res = await apiClient.get(`/kyc/${encodeURIComponent(key)}`);
      return ficheKycStateSchema.parse(res.data);
    },
  });
}

// ============================================================================
// Mutations
// ============================================================================

/** POST /kyc/:key/docs — logic.ts addKycDoc (+ journal entry, toast 'Document ajouté'). */
export function useAddClientKycDoc(name: string) {
  const key = clientKycKey(name);
  return useMutation({
    mutationFn: async (input: FicheKycDocInput): Promise<FicheKycState> => {
      const res = await apiClient.post(`/kyc/${encodeURIComponent(key)}/docs`, input);
      return ficheKycStateSchema.parse(res.data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['kyc', key] });
      toast.success(t('docToastAjoute'));
    },
  });
}

/** DELETE /kyc/:key/docs/:docId — logic.ts removeKycDoc (+ journal entry, toast 'Document supprimé'). */
export function useRemoveClientKycDoc(name: string) {
  const key = clientKycKey(name);
  return useMutation({
    mutationFn: async (docId: string): Promise<FicheKycState> => {
      const res = await apiClient.delete(
        `/kyc/${encodeURIComponent(key)}/docs/${encodeURIComponent(docId)}`,
      );
      return ficheKycStateSchema.parse(res.data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['kyc', key] });
      toast.success(t('docToastSupprime'));
    },
  });
}
