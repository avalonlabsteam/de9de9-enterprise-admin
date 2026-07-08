// TanStack Query hooks for the commandes resource (worklist + console).
// All reads/writes go through apiClient; responses are parsed with Zod so
// runtime data is typed. Every mutation invalidates ['commandes'],
// ['commandes', id] and ['factures'] (factures are derived from occurrences).
import { useMutation, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiClient } from '@/api/apiClient';
import { queryClient } from '@/lib/queryClient';
import {
  commandeSchema,
  type Commande,
  type CommandeActionInput,
  type DevisActionInput,
  type NoteInput,
} from '../schemas/commande';

const commandeEnvelopeSchema = z.object({ commande: commandeSchema });

function invalidateCommande(id: string): void {
  void queryClient.invalidateQueries({ queryKey: ['commandes'] });
  void queryClient.invalidateQueries({ queryKey: ['commandes', id] });
  void queryClient.invalidateQueries({ queryKey: ['factures'] });
}

export function useCommandes() {
  return useQuery({
    queryKey: ['commandes'],
    queryFn: async (): Promise<Commande[]> => {
      const res = await apiClient.get('/commandes');
      return commandeSchema.array().parse(res.data);
    },
  });
}

export function useCommande(id: string) {
  return useQuery({
    queryKey: ['commandes', id],
    queryFn: async (): Promise<Commande> => {
      const res = await apiClient.get(`/commandes/${id}`);
      return commandeSchema.parse(res.data);
    },
    enabled: id.length > 0,
  });
}

/** POST /commandes/:id/actions — the act/agir dispatch (approve, assign, deposit, …). */
export function useCommandeAction(id: string) {
  return useMutation({
    mutationFn: async (input: CommandeActionInput): Promise<Commande> => {
      const res = await apiClient.post(`/commandes/${id}/actions`, input);
      return commandeEnvelopeSchema.parse(res.data).commande;
    },
    onSuccess: () => invalidateCommande(id),
  });
}

/** POST /commandes/:id/devis — propose / choose / valide / refuse / simReceive / devalider. */
export function useDevisAction(id: string) {
  return useMutation({
    mutationFn: async (input: DevisActionInput): Promise<Commande> => {
      const res = await apiClient.post(`/commandes/${id}/devis`, input);
      return commandeEnvelopeSchema.parse(res.data).commande;
    },
    onSuccess: () => invalidateCommande(id),
  });
}

/** POST /commandes/:id/notes — add an internal note (author « Vous »). */
export function useAddNote(id: string) {
  return useMutation({
    mutationFn: async (input: NoteInput): Promise<Commande> => {
      const res = await apiClient.post(`/commandes/${id}/notes`, input);
      return commandeEnvelopeSchema.parse(res.data).commande;
    },
    onSuccess: () => invalidateCommande(id),
  });
}

/** POST /commandes/:id/notes/:index/handled — toggle a note's handled flag. */
export function useToggleNoteHandled(id: string) {
  return useMutation({
    mutationFn: async (index: number): Promise<Commande> => {
      const res = await apiClient.post(`/commandes/${id}/notes/${index}/handled`);
      return commandeEnvelopeSchema.parse(res.data).commande;
    },
    onSuccess: () => invalidateCommande(id),
  });
}
