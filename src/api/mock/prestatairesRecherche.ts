// GET /prestataires/recherche — mock twin of the real search endpoint.
// Derives the server row shape from the mock db prestataires so the search
// page renders identically with the passthrough disabled (offline dev).
// Limitations: the mock router collapses repeated query keys to the last value,
// so array filters (Categories, Familles, …) act on a single value here — the
// UI only ever sends one of each anyway, except famille pills. TarifMinDzd /
// TarifMaxDzd are not applied: the UI sends neither, and whether the server
// matches on overlap or containment is unverified — better unfiltered than
// filtered by a guess.
import type { Prestataire } from '@/features/prestataires/schemas/prestataire';
import type { PrestataireSearchItem, RechercheResponse } from '@/features/prestataires/schemas/recherche';
import {
  FAM_COLOR,
  FAM_LABEL,
  catObj,
  famForCat,
  slugify,
} from '@/features/prestataires/lib/taxonomy';
import type { MockHandler } from './router';
import { db } from './db';

// logic.ts _wcom/presCommunes — deterministic wilaya → communes derivation
const WCOM: Record<string, string[]> = {
  Alger: ['Bab Ezzouar', 'Birkhadem', 'Dar El Beïda', 'Hydra', 'Kouba'],
  Oran: ['Aïn El Turck', 'Bir El Djir', 'Es Sénia'],
  Blida: ['Boufarik', 'Mouzaïa'],
  Constantine: ['El Khroub', 'Hamma Bouziane'],
  Sétif: ['Aïn Arnat', 'El Eulma'],
  Annaba: ['El Bouni', 'Sidi Amar'],
  Skikda: ['Azzaba', 'Filfila'],
  Boumerdès: ['Bordj Menäiel', 'Boudouaou'],
  Tipaza: ['Cherchell', 'Koléa'],
  Tlemcen: ['Maghnia', 'Mansourah'],
};

function presZones(p: Prestataire): { w: string; c: string }[] {
  const n = parseInt(String(p.id).slice(1), 10) || 1;
  const out: { w: string; c: string }[] = [];
  p.wilayas.forEach((w) => {
    const list = WCOM[w] ?? [];
    const k = list.length ? 1 + (n % list.length) : 0;
    list.slice(0, k).forEach((c) => out.push({ w, c }));
  });
  return out;
}

/** € level (1..3) → the API's pricing bracket, aligned with tarifMin/MaxDzd. */
const TARIF_PALIER: Record<number, { code: string; label: string }> = {
  1: { code: 'eco', label: 'Économique' },
  2: { code: 'standard', label: 'Standard' },
  3: { code: 'premium', label: 'Premium' },
};

/** '2 j' → 48, '5 h' → 5; default 24. */
function delaiHeures(delai: string): number {
  const n = parseFloat(delai) || 1;
  return delai.includes('j') ? n * 24 : n;
}

/** One search row — also the `fiche` of the prestataire-detail mock. */
export function toRow(p: Prestataire): PrestataireSearchItem {
  const co = catObj(p.cat);
  const fam = famForCat(p.cat) ?? 'NOIR';
  const tarifMin = p.tarif * 25_000;
  const tarifMax = p.tarif * 50_000;
  const palier = TARIF_PALIER[p.tarif] ?? null;
  return {
    id: p.id,
    companyId: p.id,
    nom: p.name,
    pitch: null,
    logoUrl: null,
    wilaya: p.wilayas[0] ?? null,
    commune: presZones(p)[0]?.c ?? null,
    zones: presZones(p).map((z) => ({ wilayaCode: 0, wilaya: z.w, communeCode: 0, commune: z.c })),
    // Codes mirror the real API's vocabulary: label slugs and lowercase familles.
    categories: co ? [{ code: slugify(co.fr), label: co.fr }] : [],
    sousCategories: p.subs.map((s) => ({ code: slugify(s), label: s })),
    familles: [{ code: fam.toLowerCase(), label: FAM_LABEL[fam], hex: FAM_COLOR[fam] }],
    effectif: p.effectif,
    anneeCreation: new Date().getFullYear() - p.anc,
    ancienneteAnnees: p.anc,
    langues: p.langues,
    // pseudo pricing: the € level (1..3) mapped onto plausible DZD brackets
    tarifMinDzd: tarifMin,
    tarifMaxDzd: tarifMax,
    tarifPalier: palier ? { ...palier, minDzd: tarifMin, maxDzd: tarifMax } : null,
    delaiReponseHeures: delaiHeures(p.delai),
    dispoNow: p.dispo === 'now',
    kycVerifie: p.kyc,
    certifie: p.certs.length > 0,
    // The mock db has no visibility flag — every prestataire is listed.
    liste: true,
    certifications: p.certs,
    note: p.rating,
    nombreAvis: p.reviews,
    missions: p.missions,
    satisfactionPercent: p.sat,
    referencesDe9de9: p.refs.length,
    referencesClient: 0,
    contactEmail: p.email,
    contactPhone: p.phone,
    whatsAppPhone: p.wa,
    whatsAppUrl: 'https://wa.me/' + p.wa,
    createdAt: new Date().toISOString(),
  };
}

export const prestatairesRechercheHandler: MockHandler = (req) => {
  const q = req.query;
  let list = db.prestataires.slice();

  const search = (q['Q'] ?? '').trim().toLowerCase();
  if (search) {
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(search) ||
        p.email.toLowerCase().includes(search) ||
        p.phone.replace(/\s/g, '').includes(search.replace(/\s/g, '')),
    );
  }
  if (q['Categories']) {
    list = list.filter((p) => {
      const co = catObj(p.cat);
      return co !== null && slugify(co.fr) === q['Categories'];
    });
  }
  if (q['SousCategories']) list = list.filter((p) => p.subs.some((s) => slugify(s) === q['SousCategories']));
  if (q['Familles']) list = list.filter((p) => famForCat(p.cat)?.toLowerCase() === q['Familles']);
  if (q['Wilaya']) list = list.filter((p) => p.wilayas.includes(q['Wilaya'] ?? ''));
  if (q['Commune']) list = list.filter((p) => presZones(p).some((z) => z.c === q['Commune']));
  if (q['NoteMin']) list = list.filter((p) => p.rating >= Number(q['NoteMin']));
  if (q['EffectifMin']) list = list.filter((p) => p.effectif >= Number(q['EffectifMin']));
  if (q['EffectifMax']) list = list.filter((p) => p.effectif <= Number(q['EffectifMax']));
  if (q['DelaiMaxHeures']) list = list.filter((p) => delaiHeures(p.delai) <= Number(q['DelaiMaxHeures']));
  if (q['DispoNow'] === 'true') list = list.filter((p) => p.dispo === 'now');
  if (q['KycOnly'] === 'true') list = list.filter((p) => p.kyc);
  if (q['CertifieOnly'] === 'true') list = list.filter((p) => p.certs.length > 0);
  // Every mock row is listed, so Liste=false is legitimately empty here.
  if (q['Liste'] === 'false') list = [];

  const tri = q['Tri'] ?? 'rating';
  list.sort((a, b) => {
    if (tri === 'tarif') return a.tarif - b.tarif || b.rating - a.rating;
    if (tri === 'missions') return b.missions - a.missions;
    if (tri === 'dispo') return (a.dispo === 'now' ? 0 : 1) - (b.dispo === 'now' ? 0 : 1) || b.rating - a.rating;
    return b.rating - a.rating; // rating (default) — 'proximite' needs a reference point the mock lacks
  });

  const pageSize = Math.max(1, Number(q['PageSize']) || 12);
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const page = Math.min(Math.max(1, Number(q['Page']) || 1), totalPages);
  const data: RechercheResponse = {
    meta: {
      current_page: page,
      per_page: pageSize,
      total: list.length,
      total_pages: totalPages,
      has_more_pages: page < totalPages,
    },
    data: list.slice((page - 1) * pageSize, page * pageSize).map(toRow),
  };
  return { data };
};
