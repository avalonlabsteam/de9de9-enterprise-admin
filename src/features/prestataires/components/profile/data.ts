// Data hooks for the prestataire profile overlay.
// Local minimal schemas on purpose: the commandes & credits features are built
// concurrently, so we do NOT import from them. `looseObject` keeps every extra
// field intact — the shared cache entries (['commandes'], ['credits']) stay the
// full entities for other consumers.
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiClient } from '@/api/apiClient';

// ---------- commandes (missions / factures / équipe of the profile) ----------
export const profileOccStatusSchema = z.enum([
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
export type ProfileOccStatus = z.infer<typeof profileOccStatusSchema>;

export const profileOccurrenceSchema = z.looseObject({
  id: z.string(),
  date: z.string(),
  status: profileOccStatusSchema,
  ouvrier: z.string().nullable().optional(),
  facture: z
    .looseObject({
      montant: z.number(),
      deposee: z.boolean(),
      transfere: z.boolean().optional(),
    })
    .nullable()
    .optional(),
});
export type ProfileOccurrence = z.infer<typeof profileOccurrenceSchema>;

export const profileCommandeSchema = z.looseObject({
  id: z.string(),
  client: z.string(),
  service: z.string(),
  wilaya: z.string(),
  setup: z.enum(['arappeler', 'contacte', 'devis', 'assigne']),
  prestataire: z
    .looseObject({
      name: z.string(),
      phone: z.string().optional(),
      email: z.string().optional(),
    })
    .nullable(),
  occurrences: z.array(profileOccurrenceSchema),
  devis: z.array(z.looseObject({ status: z.enum(['attente', 'recu', 'valide', 'refuse']) })).optional(),
  proposedToClient: z.boolean().optional(),
});
export type ProfileCommande = z.infer<typeof profileCommandeSchema>;

/** All commandes — shared ['commandes'] cache entry (missions are filtered client-side). */
export function useAllCommandesForProfile() {
  return useQuery({
    queryKey: ['commandes'],
    queryFn: async (): Promise<ProfileCommande[]> => {
      const res = await apiClient.get('/commandes');
      return profileCommandeSchema.array().parse(res.data);
    },
  });
}

// ---------- credits ledger (versements 85% rows, logic.ts creditRaw) ----------
export const profileCreditSchema = z.looseObject({
  date: z.string(),
  type: z.enum(['rech', 'deb', 'vers']),
  client: z.string(),
  benef: z.string(),
  ref: z.string(),
  credits: z.number(),
  cmdRef: z.string(),
});
export type ProfileCredit = z.infer<typeof profileCreditSchema>;

/** Credit ledger — shared ['credits'] cache entry (vers rows filtered client-side). */
export function useCreditsForProfile() {
  return useQuery({
    queryKey: ['credits'],
    queryFn: async (): Promise<ProfileCredit[]> => {
      const res = await apiClient.get('/credits');
      return profileCreditSchema.array().parse(res.data);
    },
  });
}
