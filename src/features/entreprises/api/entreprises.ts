import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { asRecord, pickText } from '@/lib/pick';

// GET /companies/{companyId} — the company as de9de9 sees it. No guide lists
// its fields (the KYC screen reads and PUTs it back raw), so only what is
// there is shown.

export interface EntrepriseSummary {
  id: string;
  nom: string | null;
  email: string | null;
  telephone: string | null;
  wilaya: string | null;
  rc: string | null;
  nif: string | null;
  nis: string | null;
  creeLe: string | null;
}

function summaryOf(companyId: string, raw: unknown): EntrepriseSummary {
  return {
    id: pickText(raw, 'id', 'companyId') ?? companyId,
    nom: pickText(raw, 'tradeName', 'nom', 'name', 'legalName', 'raisonSociale', 'displayName'),
    email: pickText(raw, 'email', 'contactEmail'),
    telephone: pickText(raw, 'telephone', 'phone', 'phoneNumber', 'contactPhone'),
    wilaya: pickText(raw, 'wilaya', 'wilayaNom', 'address.wilaya'),
    rc: pickText(raw, 'rc', 'registreCommerce'),
    nif: pickText(raw, 'nif'),
    nis: pickText(raw, 'nis'),
    creeLe: pickText(raw, 'createdAt', 'creeLe', 'dateInscription'),
  };
}

export function useEntreprise(companyId: string) {
  return useQuery({
    queryKey: ['entreprises', companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<EntrepriseSummary> => {
      const res = await apiClient.get(`/companies/${encodeURIComponent(companyId)}`);
      if (!asRecord(res.data)) throw new Error('Unexpected company payload');
      return summaryOf(companyId, res.data);
    },
  });
}
