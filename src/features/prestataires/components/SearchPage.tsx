import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useL, useT } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useContextCommande, usePrestataires, type CtxCommande } from '../api/prestataires';
import { useReviews } from '../api/reviews';
import type { Prestataire } from '../schemas/prestataire';
import type { Review } from '../schemas/review';
import { selectionActions, useSelectionStore } from '../stores/selectionStore';
import { SelectionBar } from './SelectionBar';
import { BriefModal } from './BriefModal';
import { ReviewModal } from './ReviewModal';

/* ===================== taxonomy & helpers (ported from logic.ts) ===================== */

type FamKey = 'NOIR' | 'BLEU' | 'VERT' | 'ROUGE';

interface TaxoCat {
  id: number;
  c: 'noir' | 'bleu' | 'vert' | 'rouge';
  icon: string;
  fr: string;
  ar: string;
  subs: string[];
}

const TAXO: TaxoCat[] = [
  { id: 1, c: 'noir', icon: '⚖️', fr: 'Services Juridiques & Légaux', ar: 'الخدمات القانونية', subs: ["Avocat d'affaires", 'Notaire', 'Huissier de justice', 'Conseil juridique', 'Rédaction & révision de contrats', 'Propriété intellectuelle & marques', 'Recouvrement de créances', 'Contentieux commerciaux', 'Droit du travail & social', 'Droit fiscal & douanier', 'Conformité réglementaire & RGPD', 'Constitution de sociétés', 'Traduction juridique assermentée'] },
  { id: 2, c: 'noir', icon: '🧮', fr: 'Comptabilité, Finance & Fiscalité', ar: 'المحاسبة والمالية', subs: ['Expert-comptable', 'Commissaire aux comptes', 'Comptabilité externalisée', 'Gestion de la paie', 'Déclarations fiscales (G50, IBS, TVA)', 'Déclarations sociales (CNAS, CASNOS)', 'Audit financier & comptable', 'Contrôle de gestion & reporting', 'Conseil financier & levée de fonds', 'Montage de dossier bancaire', "Domiciliation d'entreprise", "Évaluation d'entreprise", 'Gestion de trésorerie'] },
  { id: 3, c: 'bleu', icon: '👥', fr: 'Ressources Humaines & Recrutement', ar: 'الموارد البشرية', subs: ['Cabinet de recrutement', 'Chasse de têtes', 'Travail temporaire & intérim', 'Externalisation RH (SIRH)', 'Formation professionnelle', 'Conseil RH & organisation', 'Bilan de compétences', 'Coaching dirigeants & cadres', 'Team building', 'Gestion administrative du personnel', 'Médecine du travail'] },
  { id: 4, c: 'bleu', icon: '💻', fr: 'Services Informatiques & Digitaux', ar: 'خدمات المعلوماتية', subs: ['Développement logiciel sur mesure', 'Développement web & e-commerce', 'Applications mobiles', 'Maintenance & helpdesk', 'Infogérance & gestion de parc', 'Infrastructure réseau & câblage', 'Administration serveurs & systèmes', 'Cybersécurité & audit', 'Hébergement, cloud & sauvegarde', 'Intégration ERP (SAP, Odoo)', 'Intégration CRM', 'Data, BI & IA', 'Conseil & transformation digitale', 'Vidéosurveillance IP'] },
  { id: 5, c: 'rouge', icon: '📣', fr: 'Marketing, Communication & Créatif', ar: 'التسويق والاتصال', subs: ['Agence de communication globale', 'Marketing digital & réseaux sociaux', 'SEO & publicité SEA', 'Community management & contenu', 'Production vidéo & motion design', 'Montage & post-production', 'Photographie corporate', 'Design graphique & identité visuelle', 'Branding & stratégie de marque', 'Rédaction & copywriting', 'Régie publicitaire & affichage', 'Relations presse & média', 'Impression & PLV', 'Goodies & objets publicitaires'] },
  { id: 6, c: 'vert', icon: '🧼', fr: 'Nettoyage & Hygiène', ar: 'النظافة والصحة', subs: ['Nettoyage de bureaux & locaux', 'Nettoyage industriel & usines', 'Nettoyage de fin de chantier', 'Vitres & façades', 'Désinfection 3D (dératisation)', 'Gestion & collecte des déchets', "Produits d'hygiène sanitaire", 'Entretien des espaces verts', 'Blanchisserie industrielle', 'Dégraissage de hottes & cuisines'] },
  { id: 7, c: 'noir', icon: '🛡️', fr: 'Sécurité & Gardiennage', ar: 'الأمن والحراسة', subs: ['Société de gardiennage', 'Agents de sécurité & vigiles', 'Vidéosurveillance & alarme', "Contrôle d'accès", 'Sécurité incendie & extincteurs', 'Transport de fonds & valeurs', 'Sécurité événementielle', 'Conseil & audit de sûreté', 'Maître-chien & cynophile'] },
  { id: 8, c: 'bleu', icon: '🚚', fr: 'Logistique, Transport & Supply Chain', ar: 'اللوجستيك والنقل', subs: ['Transport de marchandises (national)', 'Transit & dédouanement', 'Entreposage & stockage', 'Logistique & distribution', 'Livraison dernier kilomètre', 'Fret maritime / aérien / routier', 'Location de véhicules & camions', 'Manutention & déménagement', "Location d'engins de levage", 'Gestion de flotte'] },
  { id: 9, c: 'vert', icon: '🏗️', fr: 'BTP, Travaux & Aménagement', ar: 'البناء والأشغال', subs: ['Bâtiment (gros œuvre)', 'Aménagement & agencement de bureaux', 'Électricité industrielle & bâtiment', 'Plomberie & sanitaire', 'Climatisation, chauffage & froid (CVC)', 'Étanchéité & isolation', 'Peinture & revêtement', 'Faux plafonds & cloisons', 'Vitrerie & façades', "Bureau d'études & architecture", 'Suivi & coordination de chantier', 'Terrassement & VRD', 'Métallerie & serrurerie'] },
  { id: 10, c: 'vert', icon: '🔧', fr: 'Maintenance Industrielle & Technique', ar: 'الصيانة الصناعية', subs: ["Maintenance d'équipements industriels", 'Maintenance préventive & curative', 'Électromécanique & automatisme', 'Groupes électrogènes', 'Ascenseurs & monte-charges', 'Chaudronnerie & soudure', 'Usinage & fabrication de pièces', 'Calibrage & métrologie', 'Maintenance CVC & froid commercial', 'Maintenance informatique industrielle (GMAO)'] },
  { id: 11, c: 'noir', icon: '📊', fr: "Conseil & Stratégie d'Entreprise", ar: 'الاستشارة والاستراتيجية', subs: ['Conseil en management & organisation', 'Stratégie & business plan', 'Étude de marché & faisabilité', "Création d'entreprise", 'Certification (ISO 9001, HACCP)', 'Conduite du changement', 'Intelligence économique & veille', 'Financement & subventions (ANADE)', 'Optimisation des processus (Lean)', 'Conseil RSE & développement durable'] },
  { id: 12, c: 'rouge', icon: '📦', fr: 'Fournitures & Équipements (B2B)', ar: 'اللوازم والتجهيزات', subs: ['Fournitures de bureau', 'Mobilier de bureau', 'Matériel informatique & bureautique', 'Machines industrielles', 'Consommables & pièces de rechange', 'EPI (protection individuelle)', 'Matières premières', 'Emballage & conditionnement', 'Uniformes & vêtements de travail', 'Matériel médical & laboratoire', 'Énergie solaire & équipements'] },
  { id: 13, c: 'rouge', icon: '🍽️', fr: 'Restauration & Événementiel', ar: 'الإطعام والمناسبات', subs: ['Restauration collective & cantine', 'Traiteur événementiel', 'Plateaux repas & livraison', 'Séminaires & conférences', 'Location de salles & réunion', 'Salons & stands', 'Location de matériel événementiel', 'Animation & sonorisation', "Agence de voyage d'affaires"] },
  { id: 14, c: 'bleu', icon: '🛟', fr: 'Assurance & Gestion des Risques', ar: 'التأمين وإدارة المخاطر', subs: ['Courtier en assurance entreprise', 'Multirisque professionnelle', 'Flotte automobile', 'Responsabilité civile pro', 'Transport & marchandises', 'Santé & prévoyance collective', 'Expertise de sinistres', 'Conseil en gestion des risques'] },
  { id: 15, c: 'bleu', icon: '🌍', fr: 'Import-Export & Commerce International', ar: 'الاستيراد والتصدير', subs: ["Société d'import-export", 'Sourcing international', 'Représentation commerciale & agent', 'Domiciliation bancaire import', 'Conseil commerce extérieur & douane', 'Inspection & contrôle qualité', 'Traduction commerciale & technique'] },
  { id: 16, c: 'vert', icon: '🗂️', fr: 'Services Généraux & Support', ar: 'الخدمات العامة والدعم', subs: ['Secrétariat & assistance administrative', "Centre d'appels & relation client", 'Numérisation & archivage', 'Coursier & service de pli', 'Imprimerie & reprographie', 'Location de matériel bureautique', 'Gestion du courrier & domiciliation', 'Interprétariat & traduction'] },
];

const FAM_KEYS: FamKey[] = ['NOIR', 'BLEU', 'VERT', 'ROUGE'];
const FAM_COLOR: Record<FamKey, string> = { NOIR: '#232838', BLEU: '#2F9BE0', VERT: '#2FA86A', ROUGE: '#E7464E' };
const FAM_LABEL: Record<FamKey, string> = { NOIR: 'Noir', BLEU: 'Bleu', VERT: 'Vert', ROUGE: 'Rouge' };

function catObj(id: number | string): TaxoCat | null {
  return TAXO.find((c) => c.id === Number(id)) ?? null;
}
function famForCat(id: number | string): FamKey | null {
  const c = catObj(id);
  return c ? (c.c.toUpperCase() as FamKey) : null;
}

// logic.ts serviceCat — service → taxonomy category (ctx pre-filter)
const SERVICE_CAT: Record<string, number> = {
  'Nettoyage médical': 6,
  Plomberie: 9,
  Jardinage: 6,
  Électricité: 9,
  'Sécurité incendie': 7,
  Climatisation: 9,
  'Maintenance industrielle': 10,
  'Nettoyage vitres': 6,
  'Nettoyage bureaux': 6,
};

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

function presCommunes(p: Prestataire): { w: string; c: string }[] {
  const n = parseInt(String(p.id).slice(1), 10) || 1;
  const out: { w: string; c: string }[] = [];
  p.wilayas.forEach((w) => {
    const list = WCOM[w] ?? [];
    const k = list.length ? 1 + (n % list.length) : 0;
    list.slice(0, k).forEach((c) => out.push({ w, c }));
  });
  return out;
}

const tarifLabel = (lvl: number): string => '€'.repeat(lvl);

/* ===================== rating stats from reviews (logic.ts presStats) ===================== */

interface PresStats {
  count: number;
  avg: number;
  nClient: number;
  nDe9: number;
}

function buildStats(reviews: Review[]): Map<string, PresStats> {
  const sums = new Map<string, { sum: number; count: number; nClient: number; nDe9: number }>();
  for (const r of reviews) {
    const cur = sums.get(r.presId) ?? { sum: 0, count: 0, nClient: 0, nDe9: 0 };
    cur.sum += r.note;
    cur.count += 1;
    if (r.source === 'client') cur.nClient += 1;
    else cur.nDe9 += 1;
    sums.set(r.presId, cur);
  }
  const out = new Map<string, PresStats>();
  sums.forEach((v, k) => out.set(k, { count: v.count, avg: v.count ? v.sum / v.count : 0, nClient: v.nClient, nDe9: v.nDe9 }));
  return out;
}

/* ===================== filters & sort (logic.ts buildPrestataires) ===================== */

type SortKey = 'rating' | 'proximite' | 'tarif' | 'missions' | 'dispo';

interface Filters {
  q: string;
  families: FamKey[];
  cat: string;
  sub: string;
  wilaya: string;
  commune: string;
  minRating: number;
  minEffectif: number;
  dispoNow: boolean;
  kycOnly: boolean;
  certifOnly: boolean;
  tarif: string;
  langue: string;
}

const DEFAULT_FILTERS: Filters = {
  q: '',
  families: [],
  cat: 'all',
  sub: 'all',
  wilaya: 'all',
  commune: 'all',
  minRating: 0,
  minEffectif: 0,
  dispoNow: false,
  kycOnly: false,
  certifOnly: false,
  tarif: 'all',
  langue: 'all',
};

function applyFilters(all: Prestataire[], F: Filters): Prestataire[] {
  let list = all.slice();
  const q = F.q.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')),
    );
  }
  if (F.families.length) list = list.filter((p) => F.families.includes(famForCat(p.cat) as FamKey));
  if (F.cat !== 'all') list = list.filter((p) => p.cat === Number(F.cat));
  if (F.sub !== 'all') list = list.filter((p) => p.subs.includes(F.sub));
  if (F.wilaya !== 'all') list = list.filter((p) => p.wilayas.includes(F.wilaya));
  if (F.commune !== 'all') list = list.filter((p) => presCommunes(p).some((x) => x.c === F.commune));
  if (F.minRating) list = list.filter((p) => p.rating >= F.minRating);
  if (F.minEffectif) list = list.filter((p) => p.effectif >= F.minEffectif);
  if (F.dispoNow) list = list.filter((p) => p.dispo === 'now');
  if (F.kycOnly) list = list.filter((p) => p.kyc);
  if (F.certifOnly) list = list.filter((p) => p.certs.length > 0);
  if (F.tarif !== 'all') list = list.filter((p) => String(p.tarif) === F.tarif);
  if (F.langue !== 'all') list = list.filter((p) => p.langues.includes(F.langue));
  return list;
}

function sortList(list: Prestataire[], sort: SortKey, stats: Map<string, PresStats>, ctxW: string | null): Prestataire[] {
  const avgOf = (p: Prestataire) => {
    const s = stats.get(p.id);
    return s?.avg || p.rating;
  };
  return [...list].sort((a, b) => {
    if (sort === 'tarif') return a.tarif - b.tarif || b.rating - a.rating;
    if (sort === 'missions') return b.missions - a.missions;
    if (sort === 'dispo') return (a.dispo === 'now' ? 0 : 1) - (b.dispo === 'now' ? 0 : 1) || b.rating - a.rating;
    if (sort === 'proximite') {
      const am = ctxW && a.wilayas.includes(ctxW) ? 0 : 1;
      const bm = ctxW && b.wilayas.includes(ctxW) ? 0 : 1;
      return am - bm || b.wilayas.length - a.wilayas.length || b.rating - a.rating;
    }
    return avgOf(b) - avgOf(a);
  });
}

/* ===================== small UI primitives ===================== */

interface Opt {
  v: string;
  l: string;
}

function FilterSelect({ value, options, onChange }: { value: string; options: Opt[]; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-auto max-w-full cursor-pointer gap-1.5 rounded-[11px] border-[1.5px] border-de9-line bg-card px-[13px] py-[10px] text-[12.5px] font-semibold text-de9-slate shadow-none">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((op) => (
          <SelectItem key={op.v} value={op.v} className="text-[12.5px]">
            {op.l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TogglePill({
  active,
  color,
  label,
  dot,
  onClick,
}: {
  active: boolean;
  color: string;
  label: string;
  dot?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-de9-line bg-card px-[15px] py-[9px] text-[12.5px] font-bold text-de9-slate"
      style={{
        borderColor: active || dot ? color : undefined,
        background: active ? color : undefined,
        color: active ? '#fff' : undefined,
      }}
    >
      {dot && <span className="size-[9px] rounded-full" style={{ background: active ? '#fff' : dot }} />}
      {label}
    </button>
  );
}

/* ===================== search page ===================== */

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const ctxId = searchParams.get('ctx');
  const ctxQ = useContextCommande(ctxId);
  const ctxCmd = ctxId ? (ctxQ.data ?? null) : null;

  // Remount the page content per search context so filter/sort state
  // reinitializes from the commande (logic.ts openSearchFor) without effects.
  return <SearchPageContent key={ctxCmd ? ctxCmd.id : 'none'} ctxCmd={ctxCmd} />;
}

function SearchPageContent({ ctxCmd }: { ctxCmd: CtxCommande | null }) {
  const t = useT();
  const l = useL();
  const [searchParams, setSearchParams] = useSearchParams();
  const reviewId = searchParams.get('review');

  const presQ = usePrestataires();
  const reviewsQ = useReviews();

  const selected = useSelectionStore((s) => s.selected);
  // logic.ts openSearchFor — ctx commande pre-filters catégorie & wilaya
  const [filters, setFilters] = useState<Filters>(() => {
    if (!ctxCmd) return DEFAULT_FILTERS;
    const cat = SERVICE_CAT[ctxCmd.service];
    return { ...DEFAULT_FILTERS, cat: cat ? String(cat) : 'all', wilaya: ctxCmd.wilaya || 'all' };
  });
  const [sort, setSort] = useState<SortKey>('rating');
  const [briefOpen, setBriefOpen] = useState(false);

  const all = useMemo(() => presQ.data ?? [], [presQ.data]);
  const stats = useMemo(() => buildStats(reviewsQ.data ?? []), [reviewsQ.data]);

  // Entering a search context resets the selection (prototype openSearchFor).
  const hasCtx = !!ctxCmd;
  useEffect(() => {
    if (hasCtx) selectionActions.clear();
  }, [hasCtx]);

  const list = useMemo(
    () => sortList(applyFilters(all, filters), sort, stats, ctxCmd?.wilaya ?? null),
    [all, filters, sort, stats, ctxCmd?.wilaya],
  );

  const selectedPres = useMemo(() => all.filter((p) => selected.includes(p.id)), [all, selected]);

  /* -------- option lists (logic.ts presSelects) -------- */
  const wilayas = useMemo(() => [...new Set(all.flatMap((p) => p.wilayas))].sort(), [all]);
  const communes = useMemo(
    () =>
      [
        ...new Set(
          all
            .filter((p) => filters.wilaya === 'all' || p.wilayas.includes(filters.wilaya))
            .flatMap((p) =>
              presCommunes(p)
                .filter((x) => filters.wilaya === 'all' || x.w === filters.wilaya)
                .map((x) => x.c),
            ),
        ),
      ].sort((a, b) => a.localeCompare(b, 'fr')),
    [all, filters.wilaya],
  );
  const langs = useMemo(() => [...new Set(all.flatMap((p) => p.langues))], [all]);
  const catOpts: Opt[] = TAXO.filter(
    (c) => !filters.families.length || filters.families.includes(c.c.toUpperCase() as FamKey),
  ).map((c) => ({ v: String(c.id), l: c.icon + ' ' + l(c.fr, c.ar) }));
  const subOpts: Opt[] = (catObj(filters.cat)?.subs ?? []).map((s) => ({ v: s, l: s }));

  const sortOptions: Opt[] = [
    { v: 'rating', l: l('Note', 'التقييم') },
    { v: 'proximite', l: t('presProximite') },
    { v: 'tarif', l: t('presTarifF') },
    { v: 'missions', l: l('Missions', 'المهام') },
    { v: 'dispo', l: l('Dispo', 'التوفر') },
  ];

  const setField = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  const stripParam = (key: string) =>
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      n.delete(key);
      return n;
    });

  const openProfile = (id: string) =>
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      n.set('pres', id);
      return n;
    });

  // logic.ts addCandidate — add to selection (if absent) + toast
  const addCandidate = (id: string) => {
    if (!selected.includes(id)) selectionActions.toggle(id);
    toast.success(t('presToastAjouteCandidats'));
  };

  const reviewName = all.find((p) => p.id === reviewId)?.name ?? '';

  return (
    <div className="animate-fade-in">
      {/* ---- search context banner (?ctx=) ---- */}
      {ctxCmd && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[13px] border-[1.5px] border-[#F0E2C0] bg-[#FEF3E2] px-[18px] py-3 dark:border-[#92702A]/40 dark:bg-[#92702A]/15">
          <div className="text-[13px] text-[#92702A] dark:text-[#D9B36A]">
            🔎 {t('presContexte')}{' '}
            <b>
              {ctxCmd.id} · {ctxCmd.client}
            </b>{' '}
            — {t('presPrefiltre')}
          </div>
          <button
            type="button"
            onClick={() => stripParam('ctx')}
            className="flex-none cursor-pointer text-[12px] font-bold text-[#92702A] dark:text-[#D9B36A]"
          >
            {t('presQuitter')} ✕
          </button>
        </div>
      )}

      {/* ---- header + sort ---- */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[23px] font-extrabold text-de9-ink">{t('presTitle')}</div>
          <div className="mt-0.5 text-[13.5px] text-de9-gray">{t('presSub')}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-de9-gray">{l('Trier', 'ترتيب')}</span>
          <FilterSelect value={sort} options={sortOptions} onChange={(v) => setSort(v as SortKey)} />
        </div>
      </div>

      {/* ---- text search ---- */}
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <Input
          value={filters.q}
          onChange={(e) => setField({ q: e.target.value })}
          placeholder={t('presSearchPh')}
          className="h-auto min-w-0 flex-[1_1_320px] rounded-xl border-[1.5px] border-de9-line bg-card px-[15px] py-[11px] text-[13px] text-de9-ink shadow-none outline-none"
        />
      </div>

      {/* ---- families, selects & toggles ---- */}
      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        {FAM_KEYS.map((k) => (
          <TogglePill
            key={k}
            active={filters.families.includes(k)}
            color={FAM_COLOR[k]}
            dot={FAM_COLOR[k]}
            label={FAM_LABEL[k]}
            onClick={() =>
              setField({
                families: filters.families.includes(k)
                  ? filters.families.filter((x) => x !== k)
                  : [...filters.families, k],
              })
            }
          />
        ))}
        <FilterSelect
          value={filters.cat}
          options={[{ v: 'all', l: l('Catégorie', 'الفئة') }, ...catOpts]}
          onChange={(v) => setField({ cat: v })}
        />
        <FilterSelect
          value={filters.sub}
          options={[{ v: 'all', l: l('Sous-catégorie', 'الفئة الفرعية') }, ...subOpts]}
          onChange={(v) => setField({ sub: v })}
        />
        <FilterSelect
          value={filters.wilaya}
          options={[{ v: 'all', l: t('fWilaya') }, ...wilayas.map((w) => ({ v: w, l: w }))]}
          onChange={(v) => setField({ wilaya: v, commune: 'all' })}
        />
        <FilterSelect
          value={filters.commune}
          options={[{ v: 'all', l: t('fCommune') }, ...communes.map((c) => ({ v: c, l: c }))]}
          onChange={(v) => setField({ commune: v })}
        />
        <FilterSelect
          value={String(filters.minRating)}
          options={[
            { v: '0', l: l('Note', 'التقييم') },
            { v: '4', l: '4★+' },
            { v: '4.5', l: '4.5★+' },
          ]}
          onChange={(v) => setField({ minRating: parseFloat(v) || 0 })}
        />
        <FilterSelect
          value={String(filters.minEffectif)}
          options={[
            { v: '0', l: t('presEffectifF') },
            { v: '10', l: '10+' },
            { v: '20', l: '20+' },
            { v: '30', l: '30+' },
          ]}
          onChange={(v) => setField({ minEffectif: parseInt(v, 10) || 0 })}
        />
        <FilterSelect
          value={filters.tarif}
          options={[
            { v: 'all', l: t('presTarifF') },
            { v: '1', l: '€' },
            { v: '2', l: '€€' },
            { v: '3', l: '€€€' },
          ]}
          onChange={(v) => setField({ tarif: v })}
        />
        <FilterSelect
          value={filters.langue}
          options={[{ v: 'all', l: t('presLangueF') }, ...langs.map((lg) => ({ v: lg, l: lg }))]}
          onChange={(v) => setField({ langue: v })}
        />
        <TogglePill
          active={filters.dispoNow}
          color="#232838"
          label={t('presDispoNow')}
          onClick={() => setField({ dispoNow: !filters.dispoNow })}
        />
        <TogglePill
          active={filters.kycOnly}
          color="#232838"
          label={t('presKycVerifie')}
          onClick={() => setField({ kycOnly: !filters.kycOnly })}
        />
        <TogglePill
          active={filters.certifOnly}
          color="#232838"
          label={t('presCertifie')}
          onClick={() => setField({ certifOnly: !filters.certifOnly })}
        />
      </div>

      {/* ---- results ---- */}
      {presQ.isError && (
        <div className="mt-4 rounded-[13px] bg-[#FDEBEC] px-4 py-3 text-[13px] font-semibold text-de9-red dark:bg-[#E7464E]/15">
          {presQ.error instanceof Error ? presQ.error.message : 'Erreur'}
        </div>
      )}

      {presQ.isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-[14px] md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[280px] animate-pulse rounded-[18px] border-[1.5px] border-de9-line bg-card" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-4 text-[12.5px] font-semibold text-de9-gray">
            {list.length} {t('presResultats')}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-[14px] md:grid-cols-2 xl:grid-cols-3">
            {list.map((p) => {
              const co = catObj(p.cat);
              const fk = famForCat(p.cat) ?? 'NOIR';
              const famColor = FAM_COLOR[fk];
              const st = stats.get(p.id);
              const hasReal = (st?.count ?? 0) > 0;
              const rating = hasReal && st ? st.avg : p.rating;
              const reviewCount = hasReal && st ? st.count : p.reviews;
              const dn = p.dispo === 'now';
              const isSel = selected.includes(p.id);
              return (
                <div
                  key={p.id}
                  className={
                    'rounded-[18px] border-[1.5px] bg-card p-[18px] ' +
                    (isSel
                      ? 'border-de9-teal shadow-[0_0_0_2px_#65CBC4]'
                      : 'border-de9-line shadow-[0_8px_22px_rgba(38,50,69,.05)]')
                  }
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => selectionActions.toggle(p.id)}
                      className={
                        'mt-0.5 flex size-6 flex-none cursor-pointer items-center justify-center rounded-[7px] border-2 text-[14px] font-extrabold text-white ' +
                        (isSel ? 'border-de9-teal bg-de9-teal' : 'border-[#CBD3DB] bg-card')
                      }
                    >
                      {isSel ? '✓' : ''}
                    </button>
                    <div
                      className="flex size-[46px] flex-none items-center justify-center rounded-[13px] text-[15px] font-extrabold text-white"
                      style={{ background: famColor }}
                    >
                      {p.init}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-[7px]">
                        <button
                          type="button"
                          onClick={() => openProfile(p.id)}
                          className="cursor-pointer text-[15.5px] font-extrabold text-de9-ink"
                        >
                          {p.name}
                        </button>
                        <span className="size-[9px] rounded-full" style={{ background: famColor }} />
                        {p.kyc && (
                          <span className="rounded-full bg-[#E7F6EE] px-2 py-[3px] text-[10px] font-extrabold text-[#2FA86A] dark:bg-[#2FA86A]/15 dark:text-[#6FCF97]">
                            ✓ KYC
                          </span>
                        )}
                      </div>
                      <div className="mt-[3px] text-[12px] font-bold" style={{ color: famColor }}>
                        {co?.icon} {co ? l(co.fr, co.ar) : ''}
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-de9-slate">{p.subs.join(' · ')}</div>
                      <div className="mt-px text-[11.5px] text-de9-gray">📍 {p.wilayas.join(', ')}</div>
                    </div>
                    <div className="flex-none text-end">
                      <div className="text-[15px] font-extrabold text-de9-ink">★ {rating.toFixed(1)}</div>
                      <div className="text-[10.5px] text-[#B0B8C2]">
                        {reviewCount} {t('surNAvis')}
                      </div>
                      {hasReal && st && (
                        <div className="mt-px whitespace-nowrap text-[9px] text-[#C0C8D0]">
                          {st.nDe9} de9de9 · {st.nClient} {l('client', 'عميل')}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-[10px] bg-secondary p-[9px] text-center">
                      <div className="text-[14px] font-extrabold text-de9-ink">{p.missions}</div>
                      <div className="text-[9.5px] text-de9-gray">{t('presMissionsCount')}</div>
                    </div>
                    <div className="rounded-[10px] bg-secondary p-[9px] text-center">
                      <div className="text-[14px] font-extrabold text-[#2FA86A] dark:text-[#6FCF97]">{p.sat}%</div>
                      <div className="text-[9.5px] text-de9-gray">{t('presSatisfaction')}</div>
                    </div>
                    <div className="rounded-[10px] bg-secondary p-[9px] text-center">
                      <div className="text-[14px] font-extrabold text-de9-ink">{p.delai}</div>
                      <div className="text-[9.5px] text-de9-gray">{t('presDelaiMoyen')}</div>
                    </div>
                    <div className="rounded-[10px] bg-secondary p-[9px] text-center">
                      <div className="text-[14px] font-extrabold text-de9-ink">{p.effectif}</div>
                      <div className="text-[9.5px] text-de9-gray">{t('presPers')}</div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-[7px]">
                    <span
                      className={
                        'inline-flex items-center gap-1.5 rounded-full px-[11px] py-1.5 text-[11.5px] font-bold ' +
                        (dn
                          ? 'bg-[#E7F6EE] text-[#2FA86A] dark:bg-[#2FA86A]/15 dark:text-[#6FCF97]'
                          : 'bg-[#FBF1DF] text-[#C77C1F] dark:bg-[#C77C1F]/15 dark:text-[#D9B36A]')
                      }
                    >
                      {dn ? '●' : '📅'} {dn ? t('presDispoNow') : t('presDispoLe') + ' ' + p.dispo}
                    </span>
                  </div>

                  <div className="mt-2.5 flex min-h-[26px] flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {p.certs.map((c) => (
                        <span
                          key={c}
                          className="rounded-full bg-secondary px-[9px] py-1 text-[10.5px] font-bold text-de9-slate"
                        >
                          ✓ {c}
                        </span>
                      ))}
                    </div>
                    <span className="text-[14px] font-extrabold text-de9-ink">{tarifLabel(p.tarif)}</span>
                  </div>

                  <div className="mt-[13px] flex flex-wrap gap-2">
                    <a
                      href={'tel:+213' + p.phone.replace(/^0/, '')}
                      className="flex-[1_1_30%] rounded-[11px] border-[1.5px] border-de9-line bg-card p-2.5 text-center text-[12px] font-bold text-de9-slate no-underline"
                    >
                      📞 {t('tel')}
                    </a>
                    <a
                      href={'https://wa.me/' + p.wa}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-[1_1_30%] rounded-[11px] border-[1.5px] border-de9-line bg-card p-2.5 text-center text-[12px] font-bold text-de9-slate no-underline"
                    >
                      💬 WhatsApp
                    </a>
                    <a
                      href={'mailto:' + p.email}
                      className="flex-[1_1_30%] rounded-[11px] border-[1.5px] border-de9-line bg-card p-2.5 text-center text-[12px] font-bold text-de9-slate no-underline"
                    >
                      ✉️ Email
                    </a>
                  </div>

                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => openProfile(p.id)}
                      className="flex-1 cursor-pointer rounded-[11px] bg-secondary p-2.5 text-center text-[12px] font-bold text-de9-slate"
                    >
                      {t('presVoirProfil')}
                    </button>
                    <button
                      type="button"
                      onClick={() => addCandidate(p.id)}
                      className="flex-1 cursor-pointer rounded-[11px] bg-[#232838] p-2.5 text-center text-[12px] font-bold text-white"
                    >
                      {t('presDemanderDevis')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {list.length === 0 && (
            <div className="p-[50px] text-center text-[14px] text-de9-gray">{t('presAucun')}</div>
          )}
        </>
      )}

      {/* ---- overlays ---- */}
      <SelectionBar prestataires={all} onRequestQuotes={() => setBriefOpen(true)} />
      <BriefModal open={briefOpen} onOpenChange={setBriefOpen} selected={selectedPres} ctx={ctxCmd} />
      <ReviewModal
        presId={reviewId ?? ''}
        presName={reviewName}
        open={!!reviewId}
        onOpenChange={(o) => {
          if (!o) stripParam('review');
        }}
      />
    </div>
  );
}
