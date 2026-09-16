// TanStack Query hooks for the commandes resource (worklist + console).
// All reads/writes go through apiClient; responses are parsed with Zod so
// runtime data is typed. Every mutation invalidates ['commandes'],
// ['commandes', id] and ['factures'] (factures are derived from occurrences).
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
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
import { commandeDetailSchema, type CommandeDetail } from '../schemas/commandeDetail';
import { worklistDetailSchema, type WorklistDetail } from '../schemas/worklistDetail';
import {
  worklistKpisSchema,
  worklistResponseSchema,
  type WorklistKpis,
  type WorklistParams,
  type WorklistResponse,
} from '../schemas/worklist';

const commandeEnvelopeSchema = z.object({ commande: commandeSchema });

function invalidateCommande(id: string): void {
  void queryClient.invalidateQueries({ queryKey: ['commandes'] });
  void queryClient.invalidateQueries({ queryKey: ['commandes', id] });
  void queryClient.invalidateQueries({ queryKey: ['factures'] });
}

/**
 * GET /commandes/worklist — server-computed worklist rows, filtered and
 * paginated server-side. `keepPreviousData` keeps the current rows on screen
 * while a page/filter change refetches (no skeleton flash).
 *
 * The key lives under the ['commandes'] prefix so every commande mutation's
 * invalidateQueries picks it up for free.
 */
export function useWorklist(params: WorklistParams) {
  return useQuery({
    queryKey: ['commandes', 'worklist', params],
    queryFn: async (): Promise<WorklistResponse> => {
      const res = await apiClient.get('/commandes/worklist', { params });
      return worklistResponseSchema.parse(res.data);
    },
    placeholderData: keepPreviousData,
  });
}

/**
 * GET /commandes/worklist/kpis — the KPI-card counts in one request. Keyed
 * under ['commandes'] so every commande mutation refreshes the cards.
 */
export function useWorklistKpis() {
  return useQuery({
    queryKey: ['commandes', 'worklist-kpis'],
    queryFn: async (): Promise<WorklistKpis> => {
      const res = await apiClient.get('/commandes/worklist/kpis');
      return worklistKpisSchema.parse(res.data);
    },
  });
}

/**
 * GET /commandes/worklist/:id — one commande in detail (parties, next action,
 * SLA, devis, notes / occurrences / journal), keyed by the commande id: the
 * `id` the worklist returns for each row. The console's view for live
 * commandes, which the mock commande route and the contract-keyed
 * GET /commandes/:id can't resolve.
 * `enabled` keeps it idle on the normal path, where the mock commande loads.
 */
export function useWorklistDetail(id: string, enabled = true) {
  return useQuery({
    queryKey: ['commandes', 'worklist-detail', id],
    queryFn: async (): Promise<WorklistDetail> => {
      const res = await apiClient.get(`/commandes/worklist/${encodeURIComponent(id)}`);
      return worklistDetailSchema.parse(res.data);
    },
    enabled: enabled && id.length > 0,
  });
}

/**
 * POST /commandes/worklist/:id/next-action — run the commande's next action;
 * `:id` is the commande id (the worklist row's `id`). The request has no body,
 * so only actions without a `nextAction.form` can go through here (the server
 * answers 422 for the others). Responds with the updated detail plus `newId`,
 * the commande id after the action; 403 / 404 / 409 / 422 come back as RFC 7807
 * Problem Details.
 *
 * Refreshes everything under ['commandes'] (list, KPIs, detail) on success, and
 * the row's detail on failure too — a 409 means it moved under us.
 */
export function useWorklistNextAction(id: string) {
  return useMutation({
    mutationFn: async (): Promise<WorklistDetail> => {
      const res = await apiClient.post(`/commandes/worklist/${encodeURIComponent(id)}/next-action`);
      return worklistDetailSchema.parse(res.data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['commandes'] });
      void queryClient.invalidateQueries({ queryKey: ['factures'] });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ['commandes', 'worklist-detail', id] });
    },
  });
}

export type DevisDecision = 'valider' | 'refuser';

/**
 * POST /devis/:devisId/valider | /refuser — de9de9's verdict on a received
 * devis. Sent without a body (none documented), and the response isn't read:
 * everything under ['commandes'] refetches instead, since validating is what
 * makes a devis `choosable` and moves the row's next action. Refreshes on
 * failure too, so a 409 shows the devis's current state.
 */
export function useDevisDecision() {
  return useMutation({
    mutationFn: async ({ devisId, decision }: { devisId: string; decision: DevisDecision }): Promise<void> => {
      await apiClient.post(`/devis/${encodeURIComponent(devisId)}/${decision}`);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['commandes'] });
    },
  });
}

/**
 * POST /appels-offres/:rfqId/devis/proposer — transmit an appel d'offres's
 * validated devis to the client, who can then choose among them. `rfqId` is the
 * commande id of an 'rfq' worklist row. No request body; responds with the
 * updated worklist detail, where transmitted devis come back `choosable`.
 */
export function useProposerDevis(rfqId: string) {
  return useMutation({
    mutationFn: async (): Promise<WorklistDetail> => {
      const res = await apiClient.post(`/appels-offres/${encodeURIComponent(rfqId)}/devis/proposer`);
      return worklistDetailSchema.parse(res.data);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['commandes'] });
    },
  });
}

/**
 * S4 → V1 « Choisir le prestataire » — the client retains one of the devis they
 * were shown, which turns the appel d'offres into a visit. Per the API schema
 * the body is { devisId, date, time }: retaining a devis also schedules that
 * first visit, so the date and time are part of the same call, not a follow-up.
 *
 * `date` must be yyyy-mm-dd — the API answers 400 « date : format attendu
 * aaaa-mm-jj » otherwise — and `time` is HH:mm, as for planifier-occurrence.
 *
 * Responds with the updated detail plus `newId`: the row's id changes when it
 * becomes a visit, so the caller must follow it.
 */
export function useChoisirPrestataire(id: string) {
  return useMutation({
    mutationFn: async (input: { devisId: string; date: string; time: string }): Promise<WorklistDetail> => {
      const res = await apiClient.post(`/commandes/worklist/${encodeURIComponent(id)}/choisir-prestataire`, input);
      return worklistDetailSchema.parse(res.data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['commandes'] });
      void queryClient.invalidateQueries({ queryKey: ['factures'] });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ['commandes', 'worklist-detail', id] });
    },
  });
}

/**
 * POST /commandes/worklist/:id/planifier-occurrence — V0 → V1: plan the visit
 * at a date (ISO yyyy-mm-dd) and time. A dedicated route rather than the generic
 * actions one, and it answers with the updated worklist detail, so the console
 * re-renders from the response.
 */
export function usePlanifierOccurrence(visitId: string) {
  return useMutation({
    mutationFn: async (input: { date: string; time: string }): Promise<WorklistDetail> => {
      const res = await apiClient.post(
        `/commandes/worklist/${encodeURIComponent(visitId)}/planifier-occurrence`,
        input,
      );
      return worklistDetailSchema.parse(res.data);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['commandes'] });
    },
  });
}

/**
 * POST /commandes/worklist/:id/affecter-ouvrier — V2 → V3: assign one or more
 * of the prestataire's team members to the visit, by team-member id (live
 * visits carry several workers). The response isn't documented, so it isn't
 * read — the detail, worklist and KPIs refetch instead, on failure too.
 */
export function useAffecterOuvrier(visitId: string) {
  return useMutation({
    mutationFn: async (teamMemberIds: string[]): Promise<void> => {
      await apiClient.post(`/commandes/worklist/${encodeURIComponent(visitId)}/affecter-ouvrier`, { teamMemberIds });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['commandes'] });
    },
  });
}

/**
 * POST /commandes/worklist/:id/deposer-facture — V4 → V5: upload the invoice.
 * multipart/form-data, like demander-devis: each file goes in a `files` part,
 * and the amount / note travel as a JSON `payload` string, which the contract
 * makes optional — it is omitted when neither is filled.
 *
 * That JSON's field names are NOT documented: `montantCredits` and `note`
 * follow the API's own vocabulary (montantCredits everywhere in its responses).
 * A rejection surfaces the server's validation message, which is what would say
 * otherwise. The response isn't read; the pages refetch.
 */
export function useDeposerFacture(visitId: string) {
  return useMutation({
    mutationFn: async ({
      files,
      montantCredits,
      note,
    }: {
      files: File[];
      montantCredits?: number;
      note?: string;
    }): Promise<void> => {
      const form = new FormData();
      files.forEach((file) => form.append('files', file));
      const payload = {
        ...(montantCredits !== undefined ? { montantCredits } : {}),
        ...(note?.trim() ? { note: note.trim() } : {}),
      };
      if (Object.keys(payload).length) form.append('payload', JSON.stringify(payload));
      await apiClient.post(`/commandes/worklist/${encodeURIComponent(visitId)}/deposer-facture`, form, {
        timeout: 120_000,
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['commandes'] });
      void queryClient.invalidateQueries({ queryKey: ['factures'] });
    },
  });
}

const equipeMemberSchema = z.union([
  z.string(),
  z.looseObject({
    id: z.string().nullish(),
    fullName: z.string().nullish(),
    name: z.string().nullish(),
    nom: z.string().nullish(),
    skill: z.string().nullish(),
  }),
]);

/** One member of a prestataire's équipe — the assign step posts their ids. */
export interface EquipeMember {
  id: string;
  name: string;
  skill?: string;
}

/**
 * Équipe members out of a response, whatever shape it takes. Members without an
 * id are dropped: « affecter-ouvrier » posts ids, so a bare name can't be sent.
 */
export function equipeMembers(raw: unknown): EquipeMember[] {
  const envelope = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  const rows = z
    .array(equipeMemberSchema)
    .parse(Array.isArray(raw) ? raw : (envelope?.items ?? envelope?.data ?? envelope?.equipe ?? envelope?.membres ?? []));
  const members: EquipeMember[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (typeof row === 'string') continue;
    const id = row.id?.trim();
    const name = (row.fullName ?? row.name ?? row.nom ?? '').trim();
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    members.push({ id, name, ...(row.skill ? { skill: row.skill } : {}) });
  }
  return members;
}

/**
 * GET /companies/:companyId/equipe — the prestataire's team, as the V2 → V3
 * « Affecter un ouvrier » form lists it. Live shape: { items: [{ id, fullName,
 * skill, … }] }; a bare array or a { data | equipe | membres } envelope is
 * accepted too, with the name under `fullName`, `name` or `nom`.
 */
export function usePrestataireEquipe(companyId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['companies', companyId, 'equipe'],
    enabled: enabled && !!companyId,
    queryFn: async (): Promise<EquipeMember[]> => {
      const res = await apiClient.get(`/companies/${encodeURIComponent(companyId ?? '')}/equipe`);
      return equipeMembers(res.data);
    },
  });
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

/**
 * GET /commandes/:id — the real API's status projection envelope (per-role
 * canonicalStatus / statusLabel / ball / allowedActions, plus money).
 *
 * Separate from `useCommande`, which parses the same URL as the legacy console
 * payload (occurrences, devis, notes, brief) — the real endpoint carries none of
 * those. The key extends ['commandes', id], so `invalidateCommande` already
 * refetches it after every mutation.
 */
export function useCommandeDetail(id: string) {
  return useQuery({
    queryKey: ['commandes', id, 'detail'],
    queryFn: async (): Promise<CommandeDetail> => {
      const res = await apiClient.get(`/commandes/${id}`);
      return commandeDetailSchema.parse(res.data);
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
