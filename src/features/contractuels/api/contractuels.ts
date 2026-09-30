import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { asRecord, pickArray, pickText } from '@/lib/pick';

// A prestataire's request for de9de9 contractuels (guide 11a §6, adm.contractuels):
//   GET /admin/contractuels/demandes/{id}
//   GET /admin/contractuels/demandes/{id}/candidates
// No guide spells these payloads out yet: each field is read from the names
// the API uses elsewhere, and a missing one is simply not shown.

export interface ContractuelDemande {
  id: string;
  reference: string | null;
  prestataire: string | null;
  prestataireId: string | null;
  categorie: string | null;
  sousCategorie: string | null;
  wilaya: string | null;
  commune: string | null;
  nombre: string | null;
  statut: string | null;
  debut: string | null;
  fin: string | null;
  creeLe: string | null;
  message: string | null;
}

export interface ContractuelCandidat {
  key: string;
  nom: string | null;
  metier: string | null;
  wilaya: string | null;
  telephone: string | null;
  statut: string | null;
}

function demandeOf(id: string, raw: unknown): ContractuelDemande {
  return {
    id: pickText(raw, 'id', 'demandeId') ?? id,
    reference: pickText(raw, 'reference', 'ref'),
    prestataire: pickText(raw, 'prestataireNom', 'prestataire.nom', 'prestataire.name', 'companyName', 'entreprise'),
    prestataireId: pickText(raw, 'prestataireId', 'prestataire.companyId', 'prestataire.id', 'companyId'),
    categorie: pickText(raw, 'categorieLabel', 'categorie.nom', 'categorie', 'category', 'metier'),
    sousCategorie: pickText(raw, 'sousCategorieLabel', 'sousCategorie.nom', 'sousCategorie'),
    wilaya: pickText(raw, 'wilayaNom', 'wilaya.nom', 'wilaya'),
    commune: pickText(raw, 'communeNom', 'commune.nom', 'commune'),
    nombre: pickText(raw, 'nombrePros', 'nombre', 'nbPros', 'quantite', 'count'),
    statut: pickText(raw, 'statutLabel', 'statut', 'status'),
    debut: pickText(raw, 'dateDebut', 'debut', 'startDate'),
    fin: pickText(raw, 'dateFin', 'fin', 'endDate'),
    creeLe: pickText(raw, 'createdAt', 'creeLe'),
    message: pickText(raw, 'message', 'description', 'commentaire', 'note'),
  };
}

function candidatOf(raw: unknown, i: number): ContractuelCandidat {
  const prenom = pickText(raw, 'prenom', 'firstName');
  const nomSeul = pickText(raw, 'nom', 'lastName');
  return {
    key: pickText(raw, 'id', 'candidateId', 'workerId') ?? String(i),
    nom:
      pickText(raw, 'nomComplet', 'fullName', 'displayName', 'name') ??
      ([prenom, nomSeul].filter(Boolean).join(' ') || null),
    metier: pickText(raw, 'metier', 'categorieLabel', 'categorie', 'specialite'),
    wilaya: pickText(raw, 'wilayaNom', 'wilaya.nom', 'wilaya'),
    telephone: pickText(raw, 'telephone', 'phone'),
    statut: pickText(raw, 'statutLabel', 'statut', 'status'),
  };
}

export function useContractuelDemande(demandeId: string) {
  return useQuery({
    queryKey: ['contractuels', 'demande', demandeId],
    enabled: !!demandeId,
    queryFn: async (): Promise<ContractuelDemande> => {
      const res = await apiClient.get(`/admin/contractuels/demandes/${encodeURIComponent(demandeId)}`);
      if (!asRecord(res.data)) throw new Error('Unexpected demande payload');
      return demandeOf(demandeId, res.data);
    },
  });
}

export function useContractuelCandidats(demandeId: string) {
  return useQuery({
    queryKey: ['contractuels', 'candidates', demandeId],
    enabled: !!demandeId,
    queryFn: async (): Promise<ContractuelCandidat[]> => {
      const res = await apiClient.get(`/admin/contractuels/demandes/${encodeURIComponent(demandeId)}/candidates`);
      return pickArray(res.data, '', 'data', 'candidates', 'items').map(candidatOf);
    },
  });
}
