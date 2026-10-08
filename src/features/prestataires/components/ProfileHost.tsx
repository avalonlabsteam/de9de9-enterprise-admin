// Prestataire profile overlay — every tab is driven by one request,
// GET /prestataires/{companyId} (fiche + avis + dossier); `fromFiche` maps that
// payload onto the view-models below. Visual ground truth:
// src/admin/views/PresProfile.tsx. Opened via the '?pres=' search param
// (company id, or a mock id / name offline); closing clears the param.
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { toast } from 'sonner';
import { ArrowRight, Check, Circle, Eye, Mail, MapPin, MessageCircle, ReceiptText, Star } from 'lucide-react';
import { cn, isInk, isLiveId } from '@/lib/utils';
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { Glyph } from '@/components/common/Glyph';
import { PhoneNumber } from '@/components/common/PhoneNumber';
import { useL, useT } from '@/lib/i18n';
import { uiActions } from '@/stores/uiStore';
import { SyncPanel } from '@/features/acces/components/SyncPanel';
import { KycDossierPanel } from '@/features/kyc/components/KycDossierPanel';
import { usePrestataireFiche } from '../api/prestataires';
import type { AnnonceCarte } from '../schemas/recherche';
import { selectionActions, useSelectionStore } from '../stores/selectionStore';
import { AnnonceRows } from './AnnonceRows';
import { CategoriesDetail } from './CategoriesBlock';
import { ReviewModal } from './ReviewModal';
import {
  avisView,
  contratView,
  equipeRows,
  factureRows,
  kycView,
  missionRows,
  profileVM,
  statCards,
  versementRows,
} from './profile/fromFiche';
import { KycPanel } from './profile/KycPanel';
import { ContratPanel } from './profile/ContratPanel';
import { AvisPanel } from './profile/AvisPanel';
import { PieceViewer } from './profile/PieceViewer';
import type { PieceView } from './profile/PieceViewer';

type ProfileTab =
  | 'infos'
  | 'annonces'
  | 'kyc'
  | 'contrat'
  | 'missions'
  | 'factures'
  | 'versements'
  | 'avis'
  | 'equipe'
  | 'stats'
  | 'sync';

/**
 * An alert's `?onglet=` (guide 11a §6, adm.entreprise) → the tab the profile
 * opens on. Legal documents live in the KYC panel; `sync` is the company's
 * link to the de9de9 app (« Accès » and its alerts open it); `annonces` is a
 * search card's « Voir les N annonces »; `b2c` has no tab here, and another
 * page's `onglet` (devis, demandes…) maps to nothing.
 */
const TAB_BY_ONGLET: Partial<Record<string, ProfileTab>> = {
  annonces: 'annonces',
  avis: 'avis',
  contrat: 'contrat',
  documents: 'kyc',
  sync: 'sync',
};

/** Reads '?pres=' and renders the profile overlay; closing clears the param. */
export function PresProfileHost() {
  const [searchParams, setSearchParams] = useSearchParams();
  const presParam = searchParams.get('pres');
  const initialTab = TAB_BY_ONGLET[searchParams.get('onglet') ?? ''] ?? 'infos';

  const close = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('pres');
      return next;
    });
  };

  if (!presParam) return null;
  return <PresProfile key={presParam} presParam={presParam} initialTab={initialTab} onClose={close} />;
}

// ---------- shared bits ----------

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-extrabold tracking-[.04em] text-de9-gray uppercase">
      {children}
    </div>
  );
}

function EmptyState() {
  const t = useT();
  return <div className="p-4 text-center text-[12.5px] text-de9-gray">{t('aucuneDonnee')}</div>;
}

function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-[9px]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-[58px] animate-pulse rounded-md bg-secondary" />
      ))}
    </div>
  );
}

function ErrorBlock() {
  const l = useL();
  return (
    <div className="rounded-md bg-[#FDECEC] px-3.5 py-3 text-[12.5px] font-bold text-de9-red dark:bg-[#E7464E]/15">
      {l('Erreur de chargement des données', 'خطأ في تحميل البيانات')}
    </div>
  );
}

/** One label/value pair of the identity block. */
function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary px-3 py-2.5">
      <div className="text-[10px] font-extrabold tracking-[.04em] text-de9-gray uppercase">
        {label}
      </div>
      <div className="mt-[3px] text-[12.5px] font-bold text-de9-ink">{value || '—'}</div>
    </div>
  );
}

// ---------- profile ----------

function PresProfile({
  presParam,
  initialTab,
  onClose,
}: {
  presParam: string;
  initialTab: ProfileTab;
  onClose: () => void;
}) {
  const t = useT();
  const l = useL();
  const navigate = useNavigate();

  const [tabChosen, setTab] = useState<ProfileTab>(initialTab);
  const [piece, setPiece] = useState<PieceView | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const ficheQ = usePrestataireFiche(presParam);
  const payload = ficheQ.data ?? null;
  const selected = useSelectionStore((s) => s.selected);

  const vm = useMemo(() => (payload ? profileVM(payload) : null), [payload]);
  const kycServer = useMemo(() => (payload ? kycView(payload.dossier?.kyc, t) : null), [payload, t]);
  const avis = useMemo(() => (payload ? avisView(payload, t) : null), [payload, t]);
  const missions = useMemo(
    () => missionRows(payload?.dossier?.commandes ?? [], t),
    [payload, t],
  );
  const factures = useMemo(() => factureRows(payload?.dossier?.factures ?? [], t), [payload, t]);
  const versements = useMemo(
    () => versementRows(payload?.dossier?.versements ?? [], t),
    [payload, t],
  );
  const equipe = useMemo(() => equipeRows(payload?.dossier?.equipe ?? [], t), [payload, t]);
  const contrat = useMemo(() => contratView(payload?.dossier?.contrat), [payload]);
  const stats = useMemo(
    () => (payload && vm ? statCards(payload, vm, t) : []),
    [payload, vm, t],
  );

  const companyId = vm?.companyId ?? presParam;
  const presName = vm?.name ?? '';
  // The sync state and the KYC dossier exist on the real API only: a mock
  // profile has no « Sync » tab, and its KYC tab only reads the payload.
  const live = isLiveId(companyId);
  const tab: ProfileTab = tabChosen === 'sync' && !live ? 'infos' : tabChosen;

  // The dossier is decided piece by piece on its own screen: versions, filing
  // for the company, correcting a number and the history live there.
  const openKycReview = () => {
    onClose();
    navigate('/kyc/' + encodeURIComponent(companyId));
  };

  const openPiece = (title: string, fileName: string, documentId?: string | null) =>
    setPiece({ title, fileName, documentId });

  // logic.ts viewAsPres
  const viewAsPres = () => {
    uiActions.setRoleView('prestataire');
    toast.success(t('presToastVuePrestataire'));
    onClose();
    navigate('/commandes');
  };

  // logic.ts addCandidate
  const addCandidate = () => {
    if (!selected.includes(companyId)) selectionActions.toggle(companyId, presName);
    toast.success(t('presToastAjouteCandidats'));
  };

  // An annonce's own « Demander un devis »: the same selection, and its
  // category for the search page to filter on.
  const addCandidateFor = (a: AnnonceCarte) => {
    addCandidate();
    if (a.categorie?.code) selectionActions.askCategory(a.categorie.code);
  };

  // The company's published B2B annonces; every one of them (B2C, drafts) is in the queue.
  const annonces = payload?.fiche.annonces ?? [];
  const couvertureAnnonces = payload?.fiche.couvertureSource === 'annonces';
  // The card's categories, then those only its annonces carry — each with its own services.
  const categories = payload?.fiche.categoriesDetaillees ?? [];
  const openAnnoncesQueue = () => {
    onClose();
    navigate(`/annonces?onglet=toutes&companyId=${encodeURIComponent(companyId)}`);
  };

  // logic.ts openCmdFromFiche
  const openCmd = (id: string) => {
    onClose();
    navigate('/commandes/' + id);
  };

  const signed = contrat?.signed ?? false;

  const tabs: { key: ProfileTab; label: string }[] = [
    { key: 'infos', label: t('commonTabInfos') },
    { key: 'annonces', label: t('presAnnoncesN').replace('{n}', String(annonces.length)) },
    { key: 'kyc', label: 'KYC' },
    // Next to KYC: the de9de9 app account is activated by a verified KYC.
    ...(live ? [{ key: 'sync' as const, label: t('presTabSync') }] : []),
    { key: 'contrat', label: t('presTabContrat') },
    { key: 'missions', label: t('statMissionsL') },
    { key: 'factures', label: t('navFactures') },
    { key: 'versements', label: t('presTabVersements') },
    { key: 'avis', label: t('avis') },
    { key: 'equipe', label: t('presTabEquipe') },
    { key: 'stats', label: t('presTabStats') },
  ];

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPortal>
        <DialogOverlay className="z-[92] animate-fade-in bg-[rgba(20,28,40,.46)] supports-backdrop-filter:backdrop-blur-none" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onInteractOutside={(e) => {
            if (piece || reviewOpen) e.preventDefault();
          }}
          className="fixed start-1/2 top-1/2 z-[92] max-h-[90vh] w-full max-w-[calc(100%-24px)] -translate-x-1/2 -translate-y-1/2 animate-sheet-up overflow-y-auto rounded-xl bg-card text-de9-ink shadow-e3 outline-none sm:w-[calc(100%-48px)] sm:max-w-[560px] rtl:translate-x-1/2"
        >
          {!vm || !avis ? (
            <div className="px-4 py-6 sm:px-[26px]">
              {ficheQ.isError ? <ErrorBlock /> : <PanelSkeleton rows={4} />}
            </div>
          ) : (
            <>
              {/* ---------- header ---------- */}
              <div className="border-b border-de9-line px-4 py-6 sm:px-[26px]">
                <div className="flex items-center gap-3.5">
                  <div
                    className={cn(
                      'flex h-14 w-14 flex-none items-center justify-center rounded-md text-[18px] font-extrabold text-white',
                      isInk(vm.famColor) && 'tone-ink-bg',
                    )}
                    style={{ background: vm.famColor }}
                  >
                    {vm.init}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <DialogTitle className="font-sans text-[19px] leading-normal font-extrabold text-de9-ink">
                        {vm.name}
                      </DialogTitle>
                      {vm.famLabel && (
                        <span
                          className={cn(
                            'rounded-full px-2 py-[3px] text-[10px] font-extrabold text-white',
                            isInk(vm.famColor) && 'tone-ink-bg',
                          )}
                          style={{ background: vm.famColor }}
                        >
                          {vm.famLabel}
                        </span>
                      )}
                      {vm.kycVerifie && (
                        <span className="rounded-full bg-[#E7F6EE] px-2 py-[3px] text-[10px] font-extrabold text-[#2FA86A] dark:bg-[#2FA86A]/15 dark:text-[#6FCF97]">
                          <Glyph icon={Check} /> KYC
                        </span>
                      )}
                      <span
                        className="rounded-full px-2 py-[3px] text-[10px] font-extrabold"
                        style={{
                          background: signed ? '#E7F6EE' : '#F1F4F6',
                          color: signed ? '#178A82' : '#8A94A0',
                        }}
                      >
                        <Glyph icon={signed ? Check : Circle} /> {signed ? t('contratSigne') : t('contratNonSigne')}
                      </span>
                    </div>
                    <div className="mt-[3px] text-[12.5px] text-de9-gray">
                      <Glyph icon={Star} filled /> {vm.rating} · {avis.count || vm.reviewCount} {t('surNAvis')} · {vm.missions}{' '}
                      {t('presMissionsCount')} · {vm.satisfaction}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-[9px]">
                  {/* The number itself, to read or copy — not a call link. */}
                  <PhoneNumber value={vm.phone} className="min-w-[90px] flex-1 py-[11px] text-[12.5px] font-bold text-de9-ink" />
                  <a
                    href={vm.waUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-[90px] flex-1 rounded-full border border-de9-line bg-card py-[11px] text-center text-[12.5px] font-bold text-de9-slate no-underline"
                  >
                    <Glyph icon={MessageCircle} /> WhatsApp
                  </a>
                  <a
                    href={'mailto:' + vm.email}
                    className="min-w-[90px] flex-1 rounded-full border border-de9-line bg-card py-[11px] text-center text-[12.5px] font-bold text-de9-slate no-underline"
                  >
                    <Glyph icon={Mail} /> Email
                  </a>
                </div>
                <button
                  type="button"
                  onClick={viewAsPres}
                  className="mt-[9px] w-full cursor-pointer rounded-full bg-[#EAF2FD] py-[11px] text-center text-[12.5px] font-bold text-[#2F7FD0] dark:bg-[#2F7FD0]/15 dark:text-[#7EB5EC]"
                >
                  <Glyph icon={Eye} /> {t('voirEnTantPresta')}
                </button>
              </div>

              {/* ---------- tab bar ---------- */}
              <div className="flex gap-1.5 overflow-x-auto border-b border-de9-line px-4 pt-3 whitespace-nowrap sm:px-5">
                {tabs.map((tb) => (
                  <button
                    key={tb.key}
                    type="button"
                    onClick={() => setTab(tb.key)}
                    className={cn(
                      'flex-none cursor-pointer rounded-t-full px-[13px] py-[9px] text-xs font-bold',
                      tab === tb.key
                        ? 'bg-secondary-container text-on-secondary-container'
                        : 'bg-card text-de9-slate',
                    )}
                  >
                    {tb.label}
                  </button>
                ))}
              </div>

              {/* ---------- body ---------- */}
              <div className="flex flex-col gap-4 px-4 py-5 sm:px-[26px]">
                {/* INFOS */}
                {tab === 'infos' && (
                  <>
                    <div>
                      {categories.length > 0 ? (
                        <CategoriesDetail categories={categories} />
                      ) : (
                        <>
                          <SectionLabel>{t('presFamilles')}</SectionLabel>
                          <div
                            className="mt-1.5 text-[14px] font-bold text-de9-ink"
                            style={{ color: vm.famColor }}
                          >
                            {vm.categoryLabel}
                          </div>
                          <div className="mt-[2px] text-[12.5px] text-de9-slate">
                            {vm.subs.join(' · ') || '—'}
                          </div>
                        </>
                      )}
                      <div className={cn('text-[12.5px] text-de9-slate', categories.length > 0 ? 'mt-2.5' : 'mt-[2px]')}>
                        <Glyph icon={MapPin} /> {vm.zones.join(', ') || '—'}
                      </div>
                      {vm.pitch && (
                        <div className="mt-2 text-[12.5px] leading-normal text-de9-slate">
                          {vm.pitch}
                        </div>
                      )}
                    </div>
                    {/* The card's coverage follows the company's published B2B annonces: change those, not the card. */}
                    {couvertureAnnonces ? (
                      <div className="rounded-md bg-[#EAF2FD] px-3.5 py-2.5 text-[12.5px] text-[#2F7FD0] dark:bg-[#2F7FD0]/15 dark:text-[#7EB5EC]">
                        <div dir="auto" className="font-semibold ltr:text-left rtl:text-right">
                          {payload?.fiche.couvertureNote ?? t('annCouvertureAnnonces')}
                        </div>
                        <button
                          type="button"
                          onClick={openAnnoncesQueue}
                          className="mt-1 cursor-pointer font-bold underline-offset-2 hover:underline"
                        >
                          {t('annVoirAnnoncesEntreprise')} <Glyph icon={ArrowRight} className="rtl:rotate-180" />
                        </button>
                      </div>
                    ) : (
                      // A card filled by hand can have annonces too.
                      annonces.length > 0 && (
                        <button
                          type="button"
                          onClick={openAnnoncesQueue}
                          className="cursor-pointer self-start text-[12.5px] font-bold text-de9-teal-dark underline-offset-2 hover:underline"
                        >
                          {t('annVoirAnnoncesEntreprise')} <Glyph icon={ArrowRight} className="rtl:rotate-180" />
                        </button>
                      )
                    )}
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      <div className="rounded-md bg-secondary p-3 text-center">
                        <div className="text-[16px] font-extrabold">{vm.effectif}</div>
                        <div className="text-[10px] text-de9-gray">{t('presEquipe')}</div>
                      </div>
                      <div className="rounded-md bg-secondary p-3 text-center">
                        <div className="text-[16px] font-extrabold">
                          {vm.anciennete} {t('presAns')}
                        </div>
                        <div className="text-[10px] text-de9-gray">{t('presAnciennete')}</div>
                      </div>
                      <div className="rounded-md bg-secondary p-3 text-center">
                        <div className="text-[16px] font-extrabold">{vm.anneeCreation}</div>
                        <div className="text-[10px] text-de9-gray">{t('presAnneeCreation')}</div>
                      </div>
                    </div>
                    <div>
                      <SectionLabel>{t('presTarifFourchette')}</SectionLabel>
                      <div className="mt-1.5 text-[13px] font-bold text-de9-ink">{vm.tarif}</div>
                    </div>
                    {vm.certifications.length > 0 && (
                      <div>
                        <SectionLabel>{t('presCertifications')}</SectionLabel>
                        <div className="mt-[7px] flex flex-wrap gap-[7px]">
                          {vm.certifications.map((ct, i) => (
                            <span
                              key={i}
                              className="rounded-full bg-secondary px-2.5 py-[5px] text-[11px] font-bold text-de9-slate"
                            >
                              <Glyph icon={Check} /> {ct}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <SectionLabel>{t('presLangues')}</SectionLabel>
                      <div className="mt-1.5 text-[13px] text-de9-ink">
                        {vm.langues.join(', ') || '—'}
                      </div>
                    </div>
                    <div>
                      <SectionLabel>{t('presIdentiteLegale')}</SectionLabel>
                      <div className="mt-[7px] grid grid-cols-2 gap-2">
                        <InfoField label={l('Raison sociale', 'التسمية')} value={vm.legalName} />
                        <InfoField label="RC" value={vm.rc} />
                        <InfoField label={t('presPieceNif')} value={vm.nif} />
                        <InfoField label={t('presPieceNis')} value={vm.nis} />
                      </div>
                      {vm.address && (
                        <div className="mt-2 text-[12.5px] text-de9-slate"><Glyph icon={MapPin} /> {vm.address}</div>
                      )}
                    </div>
                  </>
                )}

                {/* ANNONCES — the published B2B ones, each with its own « Demander un devis » */}
                {tab === 'annonces' &&
                  (annonces.length > 0 ? (
                    <AnnonceRows
                      annonces={annonces}
                      onDevis={addCandidateFor}
                      rowClassName="rounded-md border border-de9-line px-3.5 py-3"
                    />
                  ) : (
                    <div className="p-4 text-center text-[12.5px] text-de9-gray">{t('presAucuneAnnonce')}</div>
                  ))}

                {/* KYC — a live company: the real dossier, one verdict per piece */}
                {tab === 'kyc' &&
                  (live ? (
                    <KycDossierPanel companyId={companyId} onOpenReview={openKycReview} />
                  ) : ficheQ.isPending || !kycServer ? (
                    <PanelSkeleton />
                  ) : (
                    <KycPanel kyc={kycServer} onOpenPiece={openPiece} />
                  ))}

                {/* CONTRAT */}
                {tab === 'contrat' && (
                  <ContratPanel presId={companyId} contrat={contrat} onOpenPiece={openPiece} />
                )}

                {/* MISSIONS */}
                {tab === 'missions' && (
                  <div className="flex flex-col gap-[9px]">
                    {missions.map((ms) => (
                      <button
                        key={ms.id}
                        type="button"
                        onClick={() => openCmd(ms.id)}
                        className="flex cursor-pointer items-center gap-[11px] rounded-md border border-de9-line bg-card px-3.5 py-3 text-start"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-bold">{ms.title}</div>
                          <div className="text-[11.5px] text-de9-gray">{ms.sub}</div>
                        </div>
                        <span
                          className="rounded-full px-2.5 py-[5px] text-[10.5px] font-bold tone-chip"
                          style={{ background: ms.badge.bg, color: ms.badge.fg }}
                        >
                          {ms.badge.label}
                        </span>
                        <span className="text-[15px] text-de9-gray">›</span>
                      </button>
                    ))}
                    {missions.length === 0 && <EmptyState />}
                  </div>
                )}

                {/* FACTURES */}
                {tab === 'factures' && (
                  <div className="flex flex-col gap-[9px]">
                    {factures.map((fc) => (
                      <div
                        key={fc.id}
                        className="flex items-center gap-[11px] rounded-md border border-de9-line px-3.5 py-3"
                      >
                        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-sm bg-[#F4EFFB] text-[16px] dark:bg-[#7C57C7]/15 text-[#7C57C7] dark:text-[#A98BE8]">
                          <Glyph icon={ReceiptText} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-bold">
                            {fc.ref} · {fc.montant}{' '}
                            <span className="text-[10px] text-de9-gray">{t('credits')}</span>
                          </div>
                          <div className="text-[11px] text-de9-gray">{fc.sub}</div>
                        </div>
                        <span
                          className="rounded-full px-2.5 py-[5px] text-[10.5px] font-bold tone-chip"
                          style={{ background: fc.badge.bg, color: fc.badge.fg }}
                        >
                          {fc.badge.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => openPiece(t('presFactureService') + ' ' + fc.ref, fc.fileName)}
                          className="flex-none cursor-pointer rounded-full bg-primary px-[11px] py-[7px] text-[11px] font-bold text-primary-foreground"
                        >
                          {t('voir')}
                        </button>
                      </div>
                    ))}
                    {factures.length === 0 && <EmptyState />}
                  </div>
                )}

                {/* VERSEMENTS */}
                {tab === 'versements' && (
                  <div className="flex flex-col gap-[9px]">
                    <div className="text-[11.5px] text-de9-gray">{t('part85')}</div>
                    {versements.map((vs) => (
                      <div
                        key={vs.id}
                        className="flex items-center gap-[11px] rounded-md border border-de9-line px-3.5 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-extrabold text-[#2FA86A] dark:text-[#6FCF97]">
                            +{vs.montant}{' '}
                            <span className="text-[10px] font-semibold text-de9-gray">
                              {t('credits')}
                            </span>
                          </div>
                          <div className="text-[11px] text-de9-gray">{vs.sub}</div>
                        </div>
                        <span className="flex-none rounded-full bg-[#E7F6EE] px-[9px] py-1 text-[10px] font-extrabold text-[#2FA86A] dark:bg-[#2FA86A]/15 dark:text-[#6FCF97]">
                          {vs.statut}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            openPiece(t('factureServicePresta') + ' — ' + presName, vs.fileName)
                          }
                          className="flex-none cursor-pointer rounded-full bg-[#EAF2FD] px-[11px] py-[7px] text-[11px] font-bold text-[#2F7FD0] dark:bg-[#2F7FD0]/15 dark:text-[#7EB5EC]"
                        >
                          <Glyph icon={ReceiptText} /> {t('voir')}
                        </button>
                      </div>
                    ))}
                    {versements.length === 0 && <EmptyState />}
                  </div>
                )}

                {/* AVIS */}
                {tab === 'avis' && <AvisPanel avis={avis} onAddReview={() => setReviewOpen(true)} />}

                {/* ÉQUIPE */}
                {tab === 'equipe' && (
                  <div className="flex flex-col gap-[9px]">
                    {equipe.map((ov) => (
                      <div
                        key={ov.id}
                        className="flex items-center gap-[11px] rounded-md border border-de9-line px-3.5 py-[11px]"
                      >
                        <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-primary-container text-[13px] font-bold text-on-primary-container">
                          {ov.init}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-bold">{ov.name}</div>
                          {ov.sub && <div className="text-[11px] text-de9-gray">{ov.sub}</div>}
                        </div>
                        {ov.role && (
                          <span className="flex-none rounded-full bg-secondary px-2.5 py-[5px] text-[10.5px] font-bold text-de9-slate">
                            {ov.role}
                          </span>
                        )}
                      </div>
                    ))}
                    {equipe.length === 0 && <EmptyState />}
                  </div>
                )}

                {/* STATS */}
                {tab === 'stats' && (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {stats.map((sc, i) => (
                      <div key={i} className="rounded-md bg-secondary p-[15px]">
                        <div
                          className={cn(
                            'text-[19px] font-extrabold',
                            sc.accent && 'text-[#2FA86A] dark:text-[#6FCF97]',
                          )}
                        >
                          {sc.value}
                          {i === 0 && (
                            <span className="text-[11px] text-de9-gray"> {t('credits')}</span>
                          )}
                        </div>
                        <div className="mt-[3px] text-[11px] text-de9-gray">{sc.label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* SYNC — the company's access to the de9de9 app and what is queued for it */}
                {tab === 'sync' && (
                  <SyncPanel
                    companyId={companyId}
                    nom={presName}
                    onOpenAcces={() => navigate('/acces?q=' + encodeURIComponent(presName))}
                  />
                )}
              </div>

              {/* ---------- footer ---------- */}
              <div className="flex gap-2.5 px-4 pt-4 pb-6 sm:px-[26px]">
                <button
                  type="button"
                  onClick={addCandidate}
                  className="flex-1 cursor-pointer rounded-full bg-primary p-[13px] text-center text-[13.5px] font-bold text-primary-foreground"
                >
                  {t('presDemanderDevis')}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-none basis-[110px] cursor-pointer rounded-full bg-secondary p-[13px] text-center text-[13.5px] font-bold text-de9-slate"
                >
                  {t('fermer')}
                </button>
              </div>

              <PieceViewer piece={piece} onClose={() => setPiece(null)} />
              {/* Above the fiche (z-92), like the piece viewer: at the default layer it opened behind it. */}
              <ReviewModal
                presId={companyId}
                presName={presName}
                open={reviewOpen}
                onOpenChange={setReviewOpen}
                layerClassName="z-[98]"
              />
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
