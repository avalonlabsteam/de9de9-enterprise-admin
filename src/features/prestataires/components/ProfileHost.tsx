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
import { cn } from '@/lib/utils';
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { useL, useT } from '@/lib/i18n';
import { uiActions } from '@/stores/uiStore';
import { usePrestataireFiche } from '../api/prestataires';
import type { KycAuditEntry, KycDoc, KycStatus } from '../schemas/prestataire';
import { selectionActions, useSelectionStore } from '../stores/selectionStore';
import { ReviewModal } from './ReviewModal';
import { KYC_LABEL_FR, nowStamp } from './profile/lib';
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
  | 'kyc'
  | 'contrat'
  | 'missions'
  | 'factures'
  | 'versements'
  | 'avis'
  | 'equipe'
  | 'stats';

/** Reads '?pres=' and renders the profile overlay; closing clears the param. */
export function PresProfileHost() {
  const [searchParams, setSearchParams] = useSearchParams();
  const presParam = searchParams.get('pres');

  const close = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('pres');
      return next;
    });
  };

  if (!presParam) return null;
  return <PresProfile key={presParam} presParam={presParam} onClose={close} />;
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
        <div key={i} className="h-[58px] animate-pulse rounded-[13px] bg-secondary" />
      ))}
    </div>
  );
}

function ErrorBlock() {
  const l = useL();
  return (
    <div className="rounded-xl bg-[#FDECEC] px-3.5 py-3 text-[12.5px] font-bold text-de9-red dark:bg-[#E7464E]/15">
      {l('Erreur de chargement des données', 'خطأ في تحميل البيانات')}
    </div>
  );
}

/** One label/value pair of the identity block. */
function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary px-3 py-2.5">
      <div className="text-[10px] font-extrabold tracking-[.04em] text-de9-gray uppercase">
        {label}
      </div>
      <div className="mt-[3px] text-[12.5px] font-bold text-de9-ink">{value || '—'}</div>
    </div>
  );
}

// ---------- profile ----------

function PresProfile({ presParam, onClose }: { presParam: string; onClose: () => void }) {
  const t = useT();
  const l = useL();
  const navigate = useNavigate();

  const [tab, setTab] = useState<ProfileTab>('infos');
  const [piece, setPiece] = useState<PieceView | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  // KYC is read-only server-side: status, motif, and every piece edit stay
  // client-side exactly like the prototype (logic.ts setKycStatus / setKycMotif
  // / addKycDoc / replaceKycDoc / removeKycDoc), layered over dossier.kyc.
  const [kycStatusLocal, setKycStatusLocal] = useState<KycStatus | null>(null);
  const [kycMotifLocal, setKycMotifLocal] = useState<string | null>(null);
  const [kycLocalAudit, setKycLocalAudit] = useState<KycAuditEntry[]>([]);
  const [kycDocNames, setKycDocNames] = useState<Record<string, string>>({});
  const [kycAddedDocs, setKycAddedDocs] = useState<KycDoc[]>([]);
  const [kycRemovedDocs, setKycRemovedDocs] = useState<string[]>([]);

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

  // ---------- kyc (server state + local overlay) ----------
  const kycStatus = kycStatusLocal ?? kycServer?.status ?? 'pending';
  const kycMotif = kycMotifLocal ?? kycServer?.motif ?? '';
  const kycDocs = [...(kycServer?.docs ?? []), ...kycAddedDocs]
    .filter((d) => !kycRemovedDocs.includes(d.id))
    .map((d) => (kycDocNames[d.id] ? { ...d, name: kycDocNames[d.id] ?? d.name } : d));
  const kycAudit = [...kycLocalAudit, ...(kycServer?.audit ?? [])];

  const logKyc = (action: string) =>
    setKycLocalAudit((prev) => [{ who: 'Karim', action, date: nowStamp() }, ...prev]);

  const setKycStatus = (status: KycStatus) => {
    const lbl = KYC_LABEL_FR[status];
    setKycStatusLocal(status);
    logKyc('Statut → ' + lbl + (kycMotif ? ' (' + kycMotif + ')' : ''));
    toast.success(t('commonKycToastStatut').replace('{n}', lbl));
  };

  const addKycDoc = (label: string, fileName: string) => {
    setKycAddedDocs((prev) => [...prev, { id: 'local:' + fileName, label, name: fileName }]);
    logKyc('Ajout document · ' + fileName);
    toast.success(t('docToastAjoute'));
  };

  const replaceKycDoc = (docId: string, fileName: string) => {
    setKycDocNames((prev) => ({ ...prev, [docId]: fileName }));
    logKyc('Remplacement document · ' + fileName);
    toast.success(t('docToastRemplace'));
  };

  const removeKycDoc = (docId: string) => {
    setKycRemovedDocs((prev) => [...prev, docId]);
    logKyc('Suppression document');
    toast.success(t('docToastSupprime'));
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

  // logic.ts openCmdFromFiche
  const openCmd = (id: string) => {
    onClose();
    navigate('/commandes/' + id);
  };

  const signed = contrat?.signed ?? false;

  const tabs: { key: ProfileTab; label: string }[] = [
    { key: 'infos', label: t('commonTabInfos') },
    { key: 'kyc', label: 'KYC' },
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
          className="fixed start-1/2 top-1/2 z-[92] max-h-[90vh] w-full max-w-[calc(100%-24px)] -translate-x-1/2 -translate-y-1/2 animate-sheet-up overflow-y-auto rounded-[22px] bg-card text-de9-ink shadow-[0_30px_70px_rgba(20,30,45,.35)] outline-none sm:w-[calc(100%-48px)] sm:max-w-[560px] rtl:translate-x-1/2"
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
                    className="flex h-14 w-14 flex-none items-center justify-center rounded-[15px] text-[18px] font-extrabold text-white"
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
                          className="rounded-full px-2 py-[3px] text-[10px] font-extrabold text-white"
                          style={{ background: vm.famColor }}
                        >
                          {vm.famLabel}
                        </span>
                      )}
                      {vm.kycVerifie && (
                        <span className="rounded-full bg-[#E7F6EE] px-2 py-[3px] text-[10px] font-extrabold text-[#2FA86A] dark:bg-[#2FA86A]/15 dark:text-[#6FCF97]">
                          ✓ KYC
                        </span>
                      )}
                      <span
                        className="rounded-full px-2 py-[3px] text-[10px] font-extrabold"
                        style={{
                          background: signed ? '#E7F6EE' : '#F1F4F6',
                          color: signed ? '#178A82' : '#8A94A0',
                        }}
                      >
                        {signed ? '✓' : '○'} {signed ? t('contratSigne') : t('contratNonSigne')}
                      </span>
                    </div>
                    <div className="mt-[3px] text-[12.5px] text-de9-gray">
                      ★ {vm.rating} · {avis.count || vm.reviewCount} {t('surNAvis')} · {vm.missions}{' '}
                      {t('presMissionsCount')} · {vm.satisfaction}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-[9px]">
                  <a
                    href={'tel:' + vm.phone.replace(/\s/g, '')}
                    className="min-w-[90px] flex-1 rounded-xl border-[1.5px] border-de9-line bg-card py-[11px] text-center text-[12.5px] font-bold text-de9-slate no-underline"
                  >
                    📞 {t('tel')}
                  </a>
                  <a
                    href={vm.waUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-[90px] flex-1 rounded-xl border-[1.5px] border-de9-line bg-card py-[11px] text-center text-[12.5px] font-bold text-de9-slate no-underline"
                  >
                    💬 WhatsApp
                  </a>
                  <a
                    href={'mailto:' + vm.email}
                    className="min-w-[90px] flex-1 rounded-xl border-[1.5px] border-de9-line bg-card py-[11px] text-center text-[12.5px] font-bold text-de9-slate no-underline"
                  >
                    ✉️ Email
                  </a>
                </div>
                <button
                  type="button"
                  onClick={viewAsPres}
                  className="mt-[9px] w-full cursor-pointer rounded-xl bg-[#EAF2FD] py-[11px] text-center text-[12.5px] font-bold text-[#2F7FD0] dark:bg-[#2F7FD0]/15 dark:text-[#7EB5EC]"
                >
                  👁 {t('voirEnTantPresta')}
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
                      'flex-none cursor-pointer rounded-t-[10px] px-[13px] py-[9px] text-xs font-bold',
                      tab === tb.key
                        ? 'bg-de9-ink text-white dark:text-[#151923]'
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
                      <div className="mt-[2px] text-[12.5px] text-de9-slate">
                        📍 {vm.zones.join(', ') || '—'}
                      </div>
                      {vm.pitch && (
                        <div className="mt-2 text-[12.5px] leading-normal text-de9-slate">
                          {vm.pitch}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      <div className="rounded-xl bg-secondary p-3 text-center">
                        <div className="text-[16px] font-extrabold">{vm.effectif}</div>
                        <div className="text-[10px] text-de9-gray">{t('presEquipe')}</div>
                      </div>
                      <div className="rounded-xl bg-secondary p-3 text-center">
                        <div className="text-[16px] font-extrabold">
                          {vm.anciennete} {t('presAns')}
                        </div>
                        <div className="text-[10px] text-de9-gray">{t('presAnciennete')}</div>
                      </div>
                      <div className="rounded-xl bg-secondary p-3 text-center">
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
                              ✓ {ct}
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
                        <div className="mt-2 text-[12.5px] text-de9-slate">📍 {vm.address}</div>
                      )}
                    </div>
                  </>
                )}

                {/* KYC */}
                {tab === 'kyc' &&
                  (ficheQ.isPending ? (
                    <PanelSkeleton />
                  ) : (
                    <KycPanel
                      status={kycStatus}
                      motif={kycMotif}
                      docs={kycDocs}
                      audit={kycAudit}
                      onStatusChange={setKycStatus}
                      onMotifChange={setKycMotifLocal}
                      onAddDoc={addKycDoc}
                      onReplaceDoc={replaceKycDoc}
                      onRemoveDoc={removeKycDoc}
                      onOpenPiece={openPiece}
                    />
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
                        className="flex cursor-pointer items-center gap-[11px] rounded-[13px] border-[1.5px] border-de9-line bg-card px-3.5 py-3 text-start"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-bold">{ms.title}</div>
                          <div className="text-[11.5px] text-de9-gray">{ms.sub}</div>
                        </div>
                        <span
                          className="rounded-full px-2.5 py-[5px] text-[10.5px] font-bold"
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
                        className="flex items-center gap-[11px] rounded-[13px] border-[1.5px] border-de9-line px-3.5 py-3"
                      >
                        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-[11px] bg-[#F4EFFB] text-[16px] dark:bg-[#7C57C7]/15">
                          🧾
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-bold">
                            {fc.ref} · {fc.montant}{' '}
                            <span className="text-[10px] text-de9-gray">{t('credits')}</span>
                          </div>
                          <div className="text-[11px] text-de9-gray">{fc.sub}</div>
                        </div>
                        <span
                          className="rounded-full px-2.5 py-[5px] text-[10.5px] font-bold"
                          style={{ background: fc.badge.bg, color: fc.badge.fg }}
                        >
                          {fc.badge.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => openPiece(t('presFactureService') + ' ' + fc.ref, fc.fileName)}
                          className="flex-none cursor-pointer rounded-[9px] bg-de9-ink px-[11px] py-[7px] text-[11px] font-bold text-white dark:text-[#151923]"
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
                        className="flex items-center gap-[11px] rounded-[13px] border-[1.5px] border-de9-line px-3.5 py-3"
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
                          className="flex-none cursor-pointer rounded-[9px] bg-[#EAF2FD] px-[11px] py-[7px] text-[11px] font-bold text-[#2F7FD0] dark:bg-[#2F7FD0]/15 dark:text-[#7EB5EC]"
                        >
                          🧾 {t('voir')}
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
                        className="flex items-center gap-[11px] rounded-[13px] border-[1.5px] border-de9-line px-3.5 py-[11px]"
                      >
                        <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-de9-ink text-[13px] font-bold text-white dark:text-[#151923]">
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
                      <div key={i} className="rounded-[14px] bg-secondary p-[15px]">
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
              </div>

              {/* ---------- footer ---------- */}
              <div className="flex gap-2.5 px-4 pt-4 pb-6 sm:px-[26px]">
                <button
                  type="button"
                  onClick={addCandidate}
                  className="flex-1 cursor-pointer rounded-[13px] bg-de9-ink p-[13px] text-center text-[13.5px] font-bold text-white dark:text-[#151923]"
                >
                  {t('presDemanderDevis')}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-none basis-[110px] cursor-pointer rounded-[13px] bg-secondary p-[13px] text-center text-[13.5px] font-bold text-de9-slate"
                >
                  {t('fermer')}
                </button>
              </div>

              <PieceViewer piece={piece} onClose={() => setPiece(null)} />
              <ReviewModal
                presId={companyId}
                presName={presName}
                open={reviewOpen}
                onOpenChange={setReviewOpen}
              />
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
