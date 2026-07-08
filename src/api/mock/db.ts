// In-memory mock database — seeded VERBATIM from the prototype (src/admin/logic.ts).
// Handlers mutate this module-level singleton; pure helpers live at the bottom.
import type {
  AuditEntry,
  AuditRole,
  Commande,
  Occurrence,
  OccStatus,
} from '@/features/commandes/schemas/commande';
import type {
  KycState,
  Prestataire,
} from '@/features/prestataires/schemas/prestataire';
import type { Review } from '@/features/prestataires/schemas/review';
import type { CreditEntry } from '@/features/credits/schemas/credit';
import type { Facture, FactureStatus } from '@/features/factures/schemas/facture';
import type { SubDemande, SubPro, SubAuditEntry } from '@/features/soustraitance/schemas/sub';
import type { HandicapWorker } from '@/features/handicap/schemas/handicap';
import type { AnalyticsData } from '@/features/analytics/schemas/analytics';

// ===================== commandes (logic.ts seed()) =====================
const occ = (
  id: string,
  date: string,
  status: OccStatus,
  ouvrier?: string,
  montant?: number,
  deposee?: boolean,
  transfere?: boolean,
): Occurrence => ({
  id,
  date,
  status,
  ouvrier: ouvrier ?? null,
  facture: montant ? { montant, deposee: !!deposee, transfere: !!transfere } : null,
});

const log = (txt: string, role: AuditRole): AuditEntry => ({ txt, role, date: '24/06/2026 · 09:14' });

const seedCommandes = (): Commande[] => [
  {
    id: 'C-2041', client: 'Clinique El Wifaq', contact: 'Dr. Slimani', phone: '0550112233',
    service: 'Nettoyage médical', wilaya: 'Alger', commune: 'Bab Ezzouar', clientEmail: 'contact@elwifaq.dz',
    type: 'recurrent', pattern: 'Hebdomadaire', setup: 'arappeler', quotes: [], prestataire: null,
    occurrences: [], sla: { mins: -35 }, audit: [log("Demande reçue via l'app cliente.", 'sys')], notes: [],
  },
  {
    id: 'C-2038', client: 'Groupe Hôtelier Atlas', contact: 'M. Brahimi', phone: '0551223344',
    service: 'Plomberie', wilaya: 'Oran', commune: 'Bir El Djir', clientEmail: 'm.brahimi@atlashotels.dz',
    type: 'ponctuel', pattern: 'Ponctuel', setup: 'contacte', quotes: [], prestataire: null,
    occurrences: [], sla: { mins: 40 }, audit: [log('Client appelé — demande confirmée.', 'client')], notes: [],
  },
  {
    id: 'C-2035', client: 'Résidence Les Oliviers', contact: 'Mme Haddad', phone: '0552334455',
    service: 'Jardinage', wilaya: 'Blida', commune: 'Boufarik', clientEmail: 'haddad@lesoliviers.dz',
    type: 'recurrent', pattern: 'Bi-mensuel', setup: 'devis', quotes: [], prestataire: null,
    occurrences: [], sla: { mins: 120 },
    brief: {
      ref: 'BR-2035', service: 'Entretien des espaces verts',
      description: "Entretien bimensuel des espaces verts de la résidence : tonte, taille des haies, désherbage, ramassage des déchets verts. 2 jardins + allées arborées, avec arrosage automatique à vérifier.",
      budgetMin: 10000, budgetMax: 18000, adresse: '14 rue des Oliviers, Cité Bouchaoui',
      commune: 'Chéraga', wilaya: 'Blida', superficie: 1200, frequence: 'Récurrent · Bi-mensuel',
      dates: 'Démarrage souhaité : 05/07/2026',
      contraintes: "Accès matin 7h–11h · matériel fourni par le prestataire · langue FR/AR · évacuation des déchets incluse",
      photos: [{ name: 'jardin-avant.jpg' }, { name: 'haies-etat.jpg' }, { name: 'allee-arboree.jpg' }],
      docs: [{ name: 'plan-espaces-verts.pdf' }], sentAt: '24/06/2026 · 09:14',
    },
    devis: [
      {
        presId: 'p4', raison: 'VertJardin', phone: '0552334455', wa: '213552334455', email: 'info@vertjardin.dz',
        status: 'recu', montant: 12000, delai: '3 j',
        details: "Forfait bimensuel tout compris : tonte, taille, désherbage et évacuation des déchets verts. Équipe de 3, matériel professionnel fourni. Garantie de reprise sous 48h.",
        docName: 'devis-vertjardin-C-2035.pdf',
      },
      {
        presId: 'p12', raison: 'EspaceNet', phone: '0560222333', wa: '213560222333', email: 'contact@espacenet.dz',
        status: 'recu', montant: 14500, delai: '2 j',
        details: "Prestation premium : entretien complet + traitement phytosanitaire saisonnier inclus. Rapport photo après chaque passage et référent dédié.",
        docName: 'devis-espacenet-C-2035.pdf',
      },
      {
        presId: 'p9', raison: 'MediClean', phone: '0566777888', wa: '213566777888', email: 'contact@mediclean.dz',
        status: 'attente', montant: 0, delai: '', details: '', docName: '',
      },
    ],
    proposedToClient: false,
    audit: [log('Brief de demande de devis envoyé à 3 prestataires — par de9de9.', 'de9')],
    notes: [{
      author: 'Lina',
      text: 'Client a rappelé, veut démarrer avant le 05/07. Prioriser le devis VertJardin.',
      date: '24/06/2026 · 10:20', handled: false,
    }],
  },
  {
    id: 'C-2030', client: 'École Ibn Sina', contact: 'M. Réda', phone: '0553445566',
    service: 'Électricité', wilaya: 'Constantine', commune: 'El Khroub', clientEmail: 'reda@ecoleibnsina.dz',
    type: 'recurrent', pattern: 'Mensuel', setup: 'assigne',
    quotes: [{ raison: 'ElectroPlus', montant: 18000, delai: '2 j', note: 'Devis retenu', chosen: true }],
    prestataire: { name: 'ElectroPlus', phone: '0560111222', email: 'contact@electroplus.dz' },
    occurrences: [occ('o1', '30/06/2026', 'toConfirm'), occ('o2', '30/07/2026', 'added')],
    sla: { mins: 90 }, audit: [log('Prestataire ElectroPlus choisi pour le client.', 'client')], notes: [],
  },
  {
    id: 'C-2024', client: 'Banque Numidia', contact: 'Mlle Cherif', phone: '0554556677',
    service: 'Sécurité incendie', wilaya: 'Alger', commune: 'Hydra', clientEmail: 'cherif@banquenumidia.dz',
    type: 'recurrent', pattern: 'Trimestriel', setup: 'assigne',
    quotes: [{ raison: 'SafeGuard', montant: 35000, delai: '1 j', note: 'Devis retenu', chosen: true }],
    prestataire: { name: 'SafeGuard', phone: '0561222333', email: 'contact@safeguard.dz' },
    occurrences: [occ('o1', '28/06/2026', 'confirmed')],
    sla: { mins: 300 }, audit: [log('Visite confirmée au nom du client (accord tél.).', 'client')], notes: [],
  },
  {
    id: 'C-2019', client: 'Pharmacie Centrale', contact: 'M. Belkacem', phone: '0555667788',
    service: 'Climatisation', wilaya: 'Sétif', commune: 'El Eulma', clientEmail: 'belkacem@pharmaciecentrale.dz',
    type: 'ponctuel', pattern: 'Ponctuel', setup: 'assigne',
    quotes: [{ raison: 'ClimaPro', montant: 18000, delai: '2 j', note: 'Devis retenu', chosen: true }],
    prestataire: { name: 'ClimaPro', phone: '0562333444', email: 'contact@climapro.dz' },
    occurrences: [occ('o1', '20/06/2026', 'doneInvoiced', 'Karim B.', 18000, true)],
    sla: { mins: 600 }, audit: [log('Facture déposée par le prestataire ClimaPro.', 'pro')], notes: [],
  },
  {
    id: 'C-2012', client: 'Usine Métalux', contact: 'M. Ouali', phone: '0556778899',
    service: 'Maintenance industrielle', wilaya: 'Annaba', commune: 'El Bouni', clientEmail: 'ouali@metalux.dz',
    type: 'recurrent', pattern: 'Mensuel', setup: 'assigne',
    quotes: [{ raison: 'IndusFix', montant: 42000, delai: '4 j', note: 'Devis retenu', chosen: true }],
    prestataire: { name: 'IndusFix', phone: '0563444555', email: 'contact@indusfix.dz' },
    occurrences: [occ('o1', '15/06/2026', 'doneDisputed', 'Sofiane M.', 42000, true)],
    sla: { mins: 50 }, audit: [log('Facture contestée par le client.', 'client')],
    notes: [{
      author: 'Karim',
      text: 'Litige facture : attendre le retour du client avant de relancer IndusFix.',
      date: '23/06/2026 · 16:05', handled: false,
    }],
  },
  {
    id: 'C-2008', client: 'Hôtel Marina', contact: 'Mme Zerrouki', phone: '0557889900',
    service: 'Nettoyage vitres', wilaya: 'Oran', commune: 'Aïn El Turck', clientEmail: 'zerrouki@hotelmarina.dz',
    type: 'ponctuel', pattern: 'Ponctuel', setup: 'assigne',
    quotes: [{ raison: 'GlassShine', montant: 25000, delai: '1 j', note: 'Devis retenu', chosen: true }],
    prestataire: { name: 'GlassShine', phone: '0564555666', email: 'contact@glassshine.dz' },
    occurrences: [occ('o1', '12/06/2026', 'doneApproved', 'Yacine T.', 25000, true)],
    sla: { mins: 200 }, audit: [log('Facture approuvée au nom du client.', 'client')], notes: [],
  },
  {
    id: 'C-1990', client: 'Centre Aïn Naadja', contact: 'M. Daoudi', phone: '0558990011',
    service: 'Nettoyage bureaux', wilaya: 'Alger', commune: 'Birkhadem', clientEmail: 'daoudi@ainnaadja.dz',
    type: 'recurrent', pattern: 'Hebdomadaire', setup: 'assigne',
    quotes: [{ raison: 'CleanCo', montant: 9000, delai: '1 j', note: 'Devis retenu', chosen: true }],
    prestataire: { name: 'CleanCo', phone: '0565666777', email: 'contact@cleanco.dz' },
    occurrences: [
      occ('o1', '01/06/2026', 'paid', 'Nadia R.', 9000, true, true),
      occ('o2', '08/06/2026', 'paid', 'Nadia R.', 9000, true, true),
      occ('o3', '29/06/2026', 'confirmedAssigned', 'Nadia R.'),
    ],
    sla: { mins: 800 }, audit: [log('2 visites réglées · prestataire payé.', 'de9')], notes: [],
  },
];

// ===================== prestataires (logic.ts prestataires(), all 24) =====================
const P = (
  id: string, name: string, cat: number, subs: string[], wilayas: string[], rating: number,
  reviews: number, missions: number, sat: number, delai: string, effectif: number, certs: string[],
  kyc: boolean, tarif: number, anc: number, langues: string[], phone: string, wa: string,
  email: string, dispo: string, refs: { client: string; service: string }[],
): Prestataire => ({
  id, name,
  init: name.replace(/[a-z ]/g, '').slice(0, 2) || name.slice(0, 2).toUpperCase(),
  cat, subs, wilayas, rating, reviews, missions, sat, delai, effectif, certs, kyc, tarif, anc,
  langues, phone, wa, email, dispo, refs,
});

const seedPrestataires = (): Prestataire[] => [
  P('p1', 'ElectroPlus', 9, ['Électricité industrielle & bâtiment', 'Climatisation, chauffage & froid (CVC)'], ['Alger', 'Blida'], 4.8, 126, 340, 97, '2 j', 18, ['Vérifié', 'Agréé CERT'], true, 2, 9, ['FR', 'AR'], '0560111222', '213560111222', 'contact@electroplus.dz', 'now', [{ client: 'École Ibn Sina', service: 'Électricité' }, { client: 'Banque Numidia', service: 'Climatisation' }]),
  P('p2', 'PlombEx', 9, ['Plomberie & sanitaire'], ['Alger', 'Oran', 'Boumerdès'], 4.6, 89, 210, 95, '1 j', 8, ['Vérifié'], true, 2, 6, ['FR', 'AR'], '0551223344', '213551223344', 'contact@plombex.dz', 'now', [{ client: 'Groupe Hôtelier Atlas', service: 'Plomberie' }]),
  P('p3', 'CleanCo', 6, ['Nettoyage de bureaux & locaux', 'Désinfection 3D (dératisation)'], ['Alger'], 4.9, 203, 512, 98, '1 j', 32, ['Vérifié', 'ISO 9001'], true, 2, 11, ['FR', 'AR', 'EN'], '0565666777', '213565666777', 'hello@cleanco.dz', 'now', [{ client: 'Centre Aïn Naadja', service: 'Nettoyage bureaux' }]),
  P('p4', 'VertJardin', 6, ['Entretien des espaces verts'], ['Blida', 'Tipaza'], 4.5, 64, 150, 93, '3 j', 12, ['Vérifié'], true, 1, 5, ['FR', 'AR'], '0552334455', '213552334455', 'info@vertjardin.dz', '05/07/2026 · 08:00', [{ client: 'Résidence Les Oliviers', service: 'Jardinage' }]),
  P('p5', 'SafeGuard', 7, ['Société de gardiennage', 'Sécurité incendie & extincteurs'], ['Alger', 'Oran'], 4.7, 110, 280, 96, '1 j', 45, ['Vérifié', 'Agréé Min. Intérieur'], true, 3, 14, ['FR', 'AR', 'EN'], '0561222333', '213561222333', 'contact@safeguard.dz', 'now', [{ client: 'Banque Numidia', service: 'Sécurité incendie' }]),
  P('p6', 'ClimaPro', 10, ['Maintenance CVC & froid commercial'], ['Sétif', 'Alger', 'Oran'], 4.4, 57, 130, 92, '2 j', 10, ['Vérifié'], true, 2, 7, ['FR', 'AR'], '0562333444', '213562333444', 'sav@climapro.dz', '02/07/2026 · 14:00', [{ client: 'Pharmacie Centrale', service: 'Climatisation' }]),
  P('p7', 'IndusFix', 10, ["Maintenance d'équipements industriels", 'Électromécanique & automatisme'], ['Annaba', 'Skikda'], 4.6, 72, 190, 94, '4 j', 22, ['Vérifié', 'Agréé'], true, 3, 10, ['FR', 'AR'], '0563444555', '213563444555', 'contact@indusfix.dz', 'now', [{ client: 'Usine Métalux', service: 'Maintenance industrielle' }]),
  P('p8', 'GlassShine', 6, ['Vitres & façades'], ['Oran'], 4.3, 41, 95, 90, '1 j', 6, [], false, 1, 3, ['FR', 'AR'], '0564555666', '213564555666', 'glassshine@mail.dz', 'now', [{ client: 'Hôtel Marina', service: 'Nettoyage vitres' }]),
  P('p9', 'MediClean', 6, ['Nettoyage industriel & usines', 'Désinfection 3D (dératisation)'], ['Alger', 'Blida'], 4.9, 88, 220, 99, '1 j', 16, ['Vérifié', 'Norme hospitalière'], true, 3, 8, ['FR', 'AR', 'EN'], '0566777888', '213566777888', 'contact@mediclean.dz', 'now', [{ client: 'Clinique El Wifaq', service: 'Nettoyage médical' }]),
  P('p10', 'BatiPro', 9, ['Plomberie & sanitaire', 'Électricité industrielle & bâtiment'], ['Constantine', 'Sétif'], 4.2, 38, 80, 89, '3 j', 9, [], false, 1, 2, ['FR', 'AR'], '0568999000', '213568999000', 'batipro@mail.dz', '08/07/2026 · 09:30', []),
  P('p11', 'SecuNord', 7, ['Société de gardiennage', 'Vidéosurveillance & alarme'], ['Oran', 'Tlemcen'], 4.6, 95, 240, 95, '1 j', 38, ['Vérifié', 'Agréé'], true, 2, 12, ['FR', 'AR'], '0569000111', '213569000111', 'contact@secunord.dz', 'now', []),
  P('p12', 'EspaceNet', 6, ['Nettoyage de bureaux & locaux', 'Entretien des espaces verts'], ['Alger', 'Tipaza'], 4.7, 76, 170, 96, '2 j', 20, ['Vérifié'], true, 2, 7, ['FR', 'AR'], '0560222333', '213560222333', 'contact@espacenet.dz', 'now', []),
  P('p13', 'JuriConseil', 1, ["Avocat d'affaires", 'Recouvrement de créances'], ['Alger'], 4.8, 64, 120, 97, '3 j', 9, ['Vérifié', "Barreau d'Alger"], true, 3, 15, ['FR', 'AR'], '0561333222', '213561333222', 'contact@juriconseil.dz', 'now', [{ client: 'Groupe Hôtelier Atlas', service: 'Conseil juridique' }]),
  P('p14', 'FiduPlus', 2, ['Expert-comptable', 'Gestion de la paie'], ['Alger', 'Blida'], 4.7, 88, 210, 96, '2 j', 14, ['Vérifié', 'Ordre des experts-comptables'], true, 2, 11, ['FR', 'AR'], '0562444333', '213562444333', 'contact@fiduplus.dz', 'now', []),
  P('p15', 'TalentRH', 3, ['Cabinet de recrutement', 'Formation professionnelle'], ['Alger'], 4.5, 52, 95, 93, '4 j', 11, ['Vérifié'], true, 2, 7, ['FR', 'AR', 'EN'], '0563555444', '213563555444', 'hello@talentrh.dz', 'now', []),
  P('p16', 'DigitalDZ', 4, ['Développement web & e-commerce', 'Cybersécurité & audit'], ['Alger', 'Oran'], 4.8, 134, 260, 97, '5 j', 24, ['Vérifié', 'ISO 27001'], true, 3, 8, ['FR', 'AR', 'EN'], '0564666555', '213564666555', 'contact@digitaldz.dz', 'now', []),
  P('p17', 'MediaCom', 5, ['Marketing digital & réseaux sociaux', 'Design graphique & identité visuelle'], ['Alger'], 4.6, 71, 180, 94, '4 j', 13, ['Vérifié'], true, 2, 6, ['FR', 'AR'], '0565777666', '213565777666', 'hello@mediacom.dz', 'now', []),
  P('p18', 'TransLog', 8, ['Transport de marchandises (national)', 'Entreposage & stockage'], ['Oran', 'Alger'], 4.4, 96, 410, 92, '2 j', 40, ['Vérifié', 'Agréé'], true, 2, 9, ['FR', 'AR'], '0566888777', '213566888777', 'contact@translog.dz', 'now', []),
  P('p19', 'StratConseil', 11, ['Conseil en management & organisation', 'Étude de marché & faisabilité'], ['Alger'], 4.9, 43, 88, 98, '6 j', 8, ['Vérifié'], true, 3, 12, ['FR', 'AR', 'EN'], '0567999888', '213567999888', 'contact@stratconseil.dz', 'now', []),
  P('p20', 'FourniPro', 12, ['Mobilier de bureau', 'Matériel informatique & bureautique'], ['Alger', 'Constantine'], 4.3, 58, 320, 90, '3 j', 17, ['Vérifié'], true, 2, 10, ['FR', 'AR'], '0568000999', '213568000999', 'ventes@fournipro.dz', 'now', []),
  P('p21', 'TraiteurPlus', 13, ['Restauration collective & cantine', 'Traiteur événementiel'], ['Alger', 'Blida'], 4.7, 112, 290, 95, '2 j', 26, ['Vérifié', 'HACCP'], true, 2, 9, ['FR', 'AR'], '0569111000', '213569111000', 'contact@traiteurplus.dz', 'now', []),
  P('p22', 'AssurPro', 14, ['Multirisque professionnelle', 'Flotte automobile'], ['Alger'], 4.5, 67, 150, 93, '3 j', 12, ['Vérifié'], true, 2, 13, ['FR', 'AR'], '0560444111', '213560444111', 'contact@assurpro.dz', 'now', []),
  P('p23', 'GlobalTrade', 15, ["Société d'import-export", 'Sourcing international'], ['Oran'], 4.4, 49, 130, 91, '7 j', 10, ['Vérifié'], true, 2, 8, ['FR', 'AR', 'EN'], '0561555222', '213561555222', 'contact@globaltrade.dz', 'now', []),
  P('p24', 'SupportNet', 16, ["Centre d'appels & relation client", 'Numérisation & archivage'], ['Alger'], 4.6, 84, 240, 94, '2 j', 35, ['Vérifié'], true, 2, 6, ['FR', 'AR', 'EN'], '0562666333', '213562666333', 'contact@supportnet.dz', 'now', []),
];

// ===================== reviews (logic.ts seedReviews()) =====================
const R = (
  id: string, presId: string, source: 'client' | 'de9de9', auteur: string, cmd: string,
  occId: string, service: string, note: number, comment: string, date: string,
): Review => ({ id, presId, source, auteur, cmd, occ: occId, service, note, comment, date });

const seedReviews = (): Review[] => [
  R('r1', 'p1', 'client', 'École Ibn Sina', 'C-2030', 'o1', 'Électricité', 5, "Intervention rapide et soignée, équipe très professionnelle.", '15/06/2026'),
  R('r2', 'p1', 'client', 'Banque Numidia', 'C-2024', 'o1', 'Climatisation', 4, "Bon travail, léger retard sur le créneau du matin.", '08/06/2026'),
  R('r3', 'p1', 'de9de9', 'de9de9 · Karim', 'C-2030', 'o1', 'Électricité', 5, "Prestataire fiable, devis clair, facturation sans litige. À reproposer.", '16/06/2026'),
  R('r4', 'p3', 'client', 'Centre Aïn Naadja', 'C-1990', 'o1', 'Nettoyage bureaux', 5, "Locaux impeccables chaque semaine, équipe ponctuelle.", '01/06/2026'),
  R('r5', 'p3', 'client', 'Centre Aïn Naadja', 'C-1990', 'o2', 'Nettoyage bureaux', 5, "Toujours au rendez-vous, très satisfait.", '08/06/2026'),
  R('r6', 'p3', 'de9de9', 'de9de9 · Lina', 'C-1990', 'o2', 'Nettoyage bureaux', 5, "Excellent partenaire récurrent, zéro réclamation client.", '09/06/2026'),
  R('r7', 'p4', 'client', 'Résidence Les Oliviers', 'C-2035', 'o1', 'Jardinage', 4, "Beau travail sur les haies, à confirmer dans la durée.", '30/05/2026'),
  R('r8', 'p4', 'de9de9', 'de9de9 · Karim', 'C-2035', 'o1', 'Entretien espaces verts', 4, "Sérieux et réactif au téléphone, tarif correct.", '31/05/2026'),
  R('r9', 'p5', 'client', 'Banque Numidia', 'C-2024', 'o1', 'Sécurité incendie', 5, "Agents très pros, rapport de visite détaillé.", '28/05/2026'),
  R('r10', 'p5', 'de9de9', 'de9de9 · Sofiane', 'C-2024', 'o1', 'Gardiennage', 5, "Agréé, ponctuel, documentation complète. Top.", '29/05/2026'),
  R('r11', 'p6', 'client', 'Pharmacie Centrale', 'C-2019', 'o1', 'Climatisation', 4, "Réparation efficace, un peu cher.", '20/06/2026'),
  R('r12', 'p6', 'de9de9', 'de9de9 · Lina', 'C-2019', 'o1', 'Maintenance CVC', 4, "Bon SAV, délais tenus.", '21/06/2026'),
  R('r13', 'p7', 'client', 'Usine Métalux', 'C-2012', 'o1', 'Maintenance industrielle', 3, "Travail correct mais facture contestée au départ.", '15/06/2026'),
  R('r14', 'p7', 'de9de9', 'de9de9 · Karim', 'C-2012', 'o1', 'Maintenance industrielle', 3, "Compétent mais suivi facturation à surveiller.", '16/06/2026'),
  R('r15', 'p8', 'client', 'Hôtel Marina', 'C-2008', 'o1', 'Nettoyage vitres', 4, "Vitres nickel, équipe sympathique.", '12/06/2026'),
  R('r16', 'p9', 'client', 'Clinique El Wifaq', 'C-2041', 'o1', 'Nettoyage médical', 5, "Respect strict des normes hospitalières, parfait.", '10/06/2026'),
  R('r17', 'p9', 'de9de9', 'de9de9 · Lina', 'C-2041', 'o1', 'Désinfection', 5, "Norme hospitalière maîtrisée, prestataire premium.", '11/06/2026'),
  R('r18', 'p12', 'client', 'Résidence Les Oliviers', 'C-2035', 'o1', 'Entretien espaces verts', 4, "Bon rapport qualité/prix, rapport photo apprécié.", '29/05/2026'),
  R('r19', 'p2', 'client', 'Groupe Hôtelier Atlas', 'C-2038', 'o1', 'Plomberie', 4, "Fuite réglée rapidement.", '17/06/2026'),
  R('r20', 'p2', 'de9de9', 'de9de9 · Sofiane', 'C-2038', 'o1', 'Plomberie', 4, "Réactif, intervention sous 24h.", '18/06/2026'),
];

// ===================== credits (logic.ts creditRawStatic() + state.rechargeDocs) =====================
const C = (
  date: string, type: 'rech' | 'deb' | 'vers', client: string, benef: string, ref: string,
  credits: number, solde: string, email: string, phone: string, cmdRef: string,
  justif?: { name: string } | null, facture?: { name: string } | null,
): CreditEntry => ({ date, type, client, benef, ref, credits, solde, email, phone, cmdRef, justif: justif ?? null, facture: facture ?? null });

const seedCredits = (): CreditEntry[] => [
  C('28/06/2026', 'rech', 'Banque Numidia', '—', 'REC-8841', 50000, '128 400', 'cherif@banquenumidia.dz', '0554556677', ''),
  C('27/06/2026', 'deb', 'Hôtel Marina', 'GlassShine', 'F-2008', -25000, '78 400', 'zerrouki@hotelmarina.dz', '0557889900', 'C-2008'),
  C('26/06/2026', 'vers', 'de9de9', 'GlassShine', 'V-7720', -21250, '—', 'contact@glassshine.dz', '0564555666', 'C-2008'),
  C('25/06/2026', 'deb', 'Pharmacie Centrale', 'ClimaPro', 'F-2019', -18000, '34 200', 'belkacem@pharmaciecentrale.dz', '0555667788', 'C-2019'),
  C('24/06/2026', 'rech', 'Clinique El Wifaq', '—', 'REC-8830', 80000, '210 000', 'contact@elwifaq.dz', '0550112233', '', { name: 'recu-versement-elwifaq.pdf' }, { name: 'facture-de9de9-REC-8830.pdf' }),
  C('22/06/2026', 'deb', 'Usine Métalux', 'IndusFix', 'F-2012', -42000, '52 800', 'ouali@metalux.dz', '0556778899', 'C-2012'),
  C('21/06/2026', 'vers', 'de9de9', 'CleanCo', 'V-7702', -15300, '—', 'contact@cleanco.dz', '0565666777', 'C-1990'),
  C('18/06/2026', 'deb', 'Centre Aïn Naadja', 'CleanCo', 'F-1990', -9000, '67 800', 'daoudi@ainnaadja.dz', '0558990011', 'C-1990'),
  C('20/06/2026', 'rech', 'Groupe Hôtelier Atlas', '—', 'REC-8815', 120000, '120 000', 'm.brahimi@atlashotels.dz', '0551223344', '', { name: 'virement-atlas.jpg' }, null),
];

// ===================== sous-traitance (logic.ts subDemandes() / subPros()) =====================
const seedSubDemandes = (): SubDemande[] => [
  { id: 'ST-101', entreprise: 'ElectroPlus', cat: 'Électricité', sub: 'Électricité industrielle & bâtiment', date: '28/06/2026' },
  { id: 'ST-102', entreprise: 'ClimaPro', cat: 'Climatisation (CVC)', sub: 'Installation & entretien clim', date: '27/06/2026' },
  { id: 'ST-103', entreprise: 'CleanCo', cat: 'Nettoyage & propreté', sub: 'Nettoyage bureaux', date: '25/06/2026' },
  { id: 'ST-104', entreprise: 'PlombEx', cat: 'Plomberie', sub: 'Plomberie & sanitaire', date: '23/06/2026' },
  { id: 'ST-105', entreprise: 'VertJardin', cat: 'Jardinage & espaces verts', sub: 'Entretien espaces verts', date: '20/06/2026' },
];

const SP = (
  id: string, name: string, wilaya: string, commune: string, cat: string, services: string,
  realises: number, recues: number, envoyees: number, abandon: number, dispo: string, phone: string,
): SubPro => ({ id, name, wilaya, commune, cat, services, realises, recues, envoyees, abandon, dispo, phone, wa: '213' + phone.replace(/^0/, '') });

const seedSubPros = (): SubPro[] => [
  SP('st1', 'Rachid Meziane', 'Alger', 'Hydra', 'Électricité', 'Électricité bâtiment · Tableaux', 128, 40, 34, 4, 'now', '0551110001'),
  SP('st2', 'Sofiane Ould', 'Alger', 'Bab Ezzouar', 'Climatisation (CVC)', 'Froid · Climatisation · Chauffage', 96, 33, 30, 6, 'now', '0551110002'),
  SP('st3', 'Nadia Belhadj', 'Blida', 'Boufarik', 'Nettoyage & propreté', 'Nettoyage bureaux · Vitres', 210, 52, 48, 3, 'now', '0551110003'),
  SP('st4', 'Karim Toumi', 'Oran', 'Bir El Djir', 'Plomberie', 'Plomberie · Sanitaire', 74, 28, 19, 12, '05/07', '0551110004'),
  SP('st5', 'Yacine Ferhat', 'Alger', 'Kouba', 'Maintenance industrielle', 'Maintenance · Soudure', 63, 22, 20, 8, 'now', '0551110005'),
  SP('st6', 'Amine Saïdi', 'Constantine', 'El Khroub', 'Électricité', 'Électricité industrielle', 41, 18, 11, 22, '08/07', '0551110006'),
  SP('st7', 'Lila Hamdi', 'Alger', 'Birkhadem', 'Jardinage & espaces verts', 'Tonte · Taille · Désherbage', 155, 44, 41, 2, 'now', '0551110007'),
  SP('st8', 'Omar Cherbi', 'Sétif', 'El Eulma', 'Climatisation (CVC)', 'Installation clim · Entretien', 88, 30, 25, 9, 'now', '0551110008'),
  SP('st9', 'Farid Benali', 'Oran', 'Es Sénia', 'Nettoyage & propreté', 'Nettoyage industriel', 119, 36, 33, 5, '06/07', '0551110009'),
  SP('st10', 'Hakim Berrada', 'Alger', 'Dar El Beïda', 'Sécurité', 'Sécurité incendie · Gardiennage', 52, 20, 14, 15, 'now', '0551110010'),
];

// ===================== handicap waitlist (logic.ts hcWaitlist() + state.hcContacted) =====================
const W = (
  id: string, entreprise: string, contact: string, phone: string, poste: string,
  nombre: number, zone: string, date: string, commentaire: string, contacted: boolean,
): HandicapWorker => ({ id, entreprise, contact, phone, poste, nombre, zone, date, commentaire, wa: '213' + phone.replace(/^0/, ''), contacted });

const seedHandicap = (): HandicapWorker[] => [
  W('hc1', 'ElectroPlus', 'Mme Cherifi', '0551223344', 'Assemblage & câblage atelier', 2, 'Alger', '28/06/2026', 'Poste adapté, atelier accessible de plain-pied.', false),
  W('hc2', 'CleanCo', 'M. Daoudi', '0558990011', "Agent d'entretien (mi-temps)", 3, 'Alger', '26/06/2026', 'Horaires aménageables.', true),
  W('hc3', 'PlombEx', 'Mme Haddad', '0552334455', 'Agent de saisie / accueil', 1, 'Blida', '24/06/2026', '', false),
  W('hc4', 'Groupe Hôtelier Atlas', 'M. Brahimi', '0551223355', 'Réception & standard téléphonique', 2, 'Oran', '21/06/2026', 'Formation interne prévue.', false),
  W('hc5', 'VertJardin', 'M. Sadi', '0552334466', 'Entretien espaces verts (poste adapté)', 1, 'Blida', '19/06/2026', '', false),
];

// ===================== KYC (logic.ts state.kyc + state.kycAudit) =====================
const seedKyc = (): Record<string, KycState> => ({
  'pres:p1': {
    status: 'verified', motif: '',
    docs: [
      { id: 'rc', label: 'Registre de commerce (RC)', name: 'rc-electroplus.pdf' },
      { id: 'nif', label: 'NIF', name: 'nif-electroplus.pdf' },
      { id: 'nis', label: 'NIS', name: 'nis-electroplus.pdf' },
    ],
    audit: [
      { who: 'Karim', action: 'Statut → Vérifié', date: '10/03/2026 · 11:20' },
      { who: 'Lina', action: 'Ajout document NIS', date: '10/03/2026 · 11:18' },
    ],
  },
  'pres:p2': {
    status: 'pending', motif: 'En attente du NIS à jour.',
    docs: [
      { id: 'rc', label: 'Registre de commerce (RC)', name: 'rc-plombex.pdf' },
      { id: 'nif', label: 'NIF', name: 'nif-plombex.jpg' },
    ],
    audit: [],
  },
  'client:Clinique El Wifaq': {
    status: 'verified', motif: '',
    docs: [
      { id: 'rc', label: 'Registre de commerce (RC)', name: 'rc-elwifaq.pdf' },
      { id: 'nif', label: 'NIF', name: 'nif-elwifaq.pdf' },
      { id: 'nis', label: 'NIS', name: 'nis-elwifaq.pdf' },
    ],
    audit: [],
  },
  'client:Usine Métalux': {
    status: 'rejected', motif: 'RC illisible — à renvoyer.',
    docs: [{ id: 'rc', label: 'Registre de commerce (RC)', name: 'rc-metalux-scan.jpg' }],
    audit: [{ who: 'Karim', action: 'Statut → Rejeté (RC illisible)', date: '16/06/2026 · 14:05' }],
  },
});

// ===================== pure helpers (ported from logic.ts) =====================
/** dd/mm/yyyy → yyyy-mm-dd ('' if malformed) */
export function toISO(ddmmyyyy: string): string {
  const p = (ddmmyyyy || '').split('/');
  if (p.length !== 3) return '';
  return p[2] + '-' + p[1] + '-' + p[0];
}

/** yyyy-mm-dd → dd/mm/yyyy (input returned unchanged if malformed) */
export function fromISO(iso: string): string {
  const p = (iso || '').split('-');
  if (p.length !== 3) return iso;
  return p[2] + '/' + p[1] + '/' + p[0];
}

/** 'dd/mm/yyyy · hh:mm' timestamp for notes / KYC journal entries */
export function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' · ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

const FACTURE_STATUSES = ['doneInvoiced', 'doneDisputed', 'doneApproved', 'paid'] as const;
const isFactureStatus = (s: OccStatus): s is FactureStatus =>
  (FACTURE_STATUSES as readonly OccStatus[]).includes(s);

/** Facture rows derived from deposited occurrence factures (logic.ts facturesForCmds). */
export function facturesFromCommandes(cmds: Commande[]): Facture[] {
  const out: Facture[] = [];
  cmds.forEach((cmd) =>
    cmd.occurrences.forEach((o) => {
      if (o.facture && o.facture.deposee && isFactureStatus(o.status)) {
        out.push({
          cmdId: cmd.id,
          occId: o.id,
          ref: 'F-' + cmd.id.replace(/[^0-9]/g, ''),
          montant: o.facture.montant,
          date: o.date,
          status: o.status,
          transfere: o.facture.transfere,
          client: cmd.client,
          contact: cmd.contact,
          email: cmd.clientEmail,
          pres: cmd.prestataire ? cmd.prestataire.name : '—',
          service: cmd.service,
        });
      }
    }),
  );
  return out;
}

// ===================== database =====================
const commandes = seedCommandes();

export const db: {
  commandes: Commande[];
  prestataires: Prestataire[];
  reviews: Review[];
  credits: CreditEntry[];
  factures: Facture[];
  subDemandes: SubDemande[];
  subPros: SubPro[];
  handicap: HandicapWorker[];
  kyc: Record<string, KycState>;
  workers: string[];
} = {
  commandes,
  prestataires: seedPrestataires(),
  reviews: seedReviews(),
  credits: seedCredits(),
  factures: facturesFromCommandes(commandes),
  subDemandes: seedSubDemandes(),
  subPros: seedSubPros(),
  handicap: seedHandicap(),
  kyc: seedKyc(),
  workers: ['Karim B.', 'Sofiane M.', 'Yacine T.', 'Nadia R.'],
};

// Sub-traitance salarié audit trail (logic.ts state.subAudit, prepend on confirmSalarie).
export const subAudit: SubAuditEntry[] = [];

// ===================== stateful helpers (ported from logic.ts) =====================
export function cmdById(id: string): Commande | undefined {
  return db.commandes.find((c) => c.id === id);
}

/** Prepend an audit entry (logic.ts addAudit — same 'Aujourd'hui · 13:xx' stamp). */
export function addAudit(cmd: Commande, txt: string, role: AuditRole): void {
  cmd.audit = [{ txt, role, date: "Aujourd'hui · 13:" + (10 + (cmd.audit.length % 49)) }, ...cmd.audit];
}

/** Earliest non-terminal occurrence, by action priority (logic.ts currentOcc). */
export function currentOcc(cmd: Commande): Occurrence | null {
  const order: OccStatus[] = [
    'doneDisputed', 'doneApproved', 'doneInvoiced', 'doneNoInvoice',
    'confirmed', 'confirmedAssigned', 'toConfirm', 'added',
  ];
  let best: Occurrence | null = null;
  let bi = 99;
  cmd.occurrences.forEach((o) => {
    const i = order.indexOf(o.status);
    if (i >= 0 && i < bi) {
      bi = i;
      best = o;
    }
  });
  return best;
}

/** Get-or-create the KYC state for a key (logic.ts kycOf default shape). */
export function kycOf(key: string): KycState {
  let k = db.kyc[key];
  if (!k) {
    k = { status: 'pending', motif: '', docs: [], audit: [] };
    db.kyc[key] = k;
  }
  return k;
}

/** Prepend a KYC journal entry (logic.ts logKyc — actor 'Karim'). */
export function logKyc(key: string, action: string): void {
  const k = kycOf(key);
  k.audit = [{ who: 'Karim', action, date: nowStamp() }, ...k.audit];
}

// ===================== analytics seed (logic.ts buildAnalytics) =====================
const analyticsBars: [number, number, number][] = [
  [60, 30, 22], [72, 38, 30], [55, 40, 28], [85, 52, 40], [70, 48, 36], [95, 60, 45],
];
const analyticsLabs = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'];

export const analyticsSeed: AnalyticsData = {
  kpis: [
    { key: 'vendus', value: '250 K', delta: '+12,4%', positive: true },
    { key: 'depenses', value: '85 K', delta: '+6,1%', positive: true },
    { key: 'verses', value: '36,5 K', delta: '+4,0%', positive: true },
    { key: 'marge', value: '~12,7 K', delta: '-2,3%', positive: false },
    { key: 'circulation', value: '410 K', delta: '+9,8%', positive: true },
  ],
  chartBars: analyticsBars.map((b, i) => ({ label: analyticsLabs[i], vendus: b[0], depenses: b[1], verses: b[2] })),
  topClients: [
    { init: 'GA', name: 'Groupe Hôtelier Atlas', value: '120 K', color: '#2F9BE0' },
    { init: 'CE', name: 'Clinique El Wifaq', value: '80 K', color: '#E7464E' },
    { init: 'BN', name: 'Banque Numidia', value: '50 K', color: '#2FA86A' },
  ],
  topPrestataires: [
    { init: 'IF', name: 'IndusFix', value: '42 K', color: '#232838' },
    { init: 'SG', name: 'SafeGuard', value: '35 K', color: '#7C57C7' },
    { init: 'CP', name: 'ClimaPro', value: '18 K', color: '#D9871F' },
  ],
};
