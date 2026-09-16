// B2B services taxonomy (ported from logic.ts) — shared by the search page
// (filter options, ctx pre-filter) and the mock recherche endpoint (row
// derivation). Category ids double as the `Categories` codes sent to the
// search API; sub-category names are their own codes.

export type FamKey = 'NOIR' | 'BLEU' | 'VERT' | 'ROUGE';

export interface TaxoCat {
  id: number;
  c: 'noir' | 'bleu' | 'vert' | 'rouge';
  icon: string;
  fr: string;
  ar: string;
  subs: string[];
}

export const TAXO: TaxoCat[] = [
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

export const FAM_KEYS: FamKey[] = ['NOIR', 'BLEU', 'VERT', 'ROUGE'];
export const FAM_COLOR: Record<FamKey, string> = { NOIR: '#232838', BLEU: '#2F9BE0', VERT: '#2FA86A', ROUGE: '#E7464E' };
export const FAM_LABEL: Record<FamKey, string> = { NOIR: 'Noir', BLEU: 'Bleu', VERT: 'Vert', ROUGE: 'Rouge' };

export function catObj(id: number | string): TaxoCat | null {
  return TAXO.find((c) => c.id === Number(id)) ?? null;
}

/**
 * French label → the API's category/sub-category code, verified against live
 * responses: '&' becomes 'et', accents are stripped, everything else
 * non-alphanumeric collapses to '-' (e.g. 'Comptabilité, Finance & Fiscalité'
 * → 'comptabilite-finance-et-fiscalite', 'Bâtiment (gros œuvre)' →
 * 'batiment-gros-uvre').
 */
export function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/&/g, 'et')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function famForCat(id: number | string): FamKey | null {
  const c = catObj(id);
  return c ? (c.c.toUpperCase() as FamKey) : null;
}

// logic.ts serviceCat — service → taxonomy category (ctx pre-filter)
export const SERVICE_CAT: Record<string, number> = {
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
