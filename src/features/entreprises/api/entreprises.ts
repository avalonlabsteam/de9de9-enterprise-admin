import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { asRecord, pickText } from '@/lib/pick';

// GET /companies/{companyId} — the company as de9de9 sees it. No guide lists
// its fields (the KYC screen reads and PUTs it back raw), so only what is
// there is shown. The two access flags are the exception (guide « Accès »).

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
  /** B2B access — false = suspended by de9de9. Null on an API that predates the flag. */
  b2bEnabled: boolean | null;
  /** B2C access — true = granted (the bridge to the de9de9 app). Null likewise. */
  b2cEnabled: boolean | null;
}

function flagOf(raw: unknown, key: string): boolean | null {
  const value = asRecord(raw)?.[key];
  return typeof value === 'boolean' ? value : null;
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
    b2bEnabled: flagOf(raw, 'b2bEnabled'),
    b2cEnabled: flagOf(raw, 'b2cEnabled'),
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
