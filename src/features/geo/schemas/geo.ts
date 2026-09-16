import { z } from 'zod';

// ============================================================================
// Contract: GET {VITE_API_URL}/geo/wilayas
//           GET {VITE_API_URL}/geo/wilayas/{code}/communes
// Real paths: /api/v1/geo/wilayas… (public — no auth required)
// Source: https://api.entreprise.de9de9.dz/swagger
// ============================================================================

export const wilayaSchema = z.object({
  code: z.number(),
  nom: z.string(),
  nomAr: z.string(),
  nombreCommunes: z.number(),
});
export type Wilaya = z.infer<typeof wilayaSchema>;

export const communeSchema = z.object({
  code: z.number(),
  nom: z.string(),
  nomAr: z.string(),
});
export type Commune = z.infer<typeof communeSchema>;
