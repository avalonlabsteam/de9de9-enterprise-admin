// Prestataire profile overlay — ported from src/admin/views/PresProfile.tsx +
// logic.ts renderVals profile section (buildPresFicheExtra, profileReviews,
// buildContractVM, synthPres). Opened via the '?pres=' search param
// (prestataire id or name); closing clears the param.
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { useL, useT } from '@/lib/i18n';
import { uiActions } from '@/stores/uiStore';
import { usePrestataires } from '../api/prestataires';
import { useReviews } from '../api/reviews';
import { useKyc } from '../api/kyc';
import type { KycAuditEntry, KycStatus } from '../schemas/prestataire';
import { selectionActions, useSelectionStore } from '../stores/selectionStore';
import { ReviewModal } from './ReviewModal';
import { useAllCommandesForProfile, useCreditsForProfile } from './profile/data';
import {
  FAM_COLOR,
  FAM_LABEL,
  KYC_LABEL_FR,
  catMeta,
  facturesForMissions,
  fmtMoney,
  missionLine,
  nowStamp,
  ouvriersForMissions,
  presStats,
  subjectFromPres,
  synthSubject,
  tarifLabel,
  withDay,
} from './profile/lib';
import type { ProfileSubject } from './profile/lib';
import { useContractsStore } from './profile/contractsStore';
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

/** Reads '?pres=' (id or name) and renders the profile overlay; closing clears the param. */
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

// ---------- profile ----------

function PresProfile({ presParam, onClose }: { presParam: string; onClose: () => void }) {
  const t = useT();
  const l = useL();
  const navigate = useNavigate();

  const [tab, setTab] = useState<ProfileTab>('infos');
  const [piece, setPiece] = useState<PieceView | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  // KYC status / motif / replaced doc names have no API endpoint — they stay
  // client-side exactly like the prototype's local state (logic.ts setKycStatus,
  // setKycMotif, replaceKycDoc), layered over the fetched KYC state.
  const [kycStatusLocal, setKycStatusLocal] = useState<KycStatus | null>(null);
  const [kycMotifLocal, setKycMotifLocal] = useState<string | null>(null);
  const [kycLocalAudit, setKycLocalAudit] = useState<KycAuditEntry[]>([]);
  const [kycDocNames, setKycDocNames] = useState<Record<string, string>>({});

  const presQ = usePrestataires();
  const cmdsQ = useAllCommandesForProfile();
  const creditsQ = useCreditsForProfile();

  // logic.ts renderVals — resolve by id, then by name, else synthPres()
  const subject: ProfileSubject | null = useMemo(() => {
    if (!presQ.data) return null;
    const p =
      presQ.data.find((x) => x.id === presParam) ??
      presQ.data.find((x) => x.name === presParam);
    if (p) return subjectFromPres(p);
    const missions = (cmdsQ.data ?? []).filter((c) => c.prestataire?.name === presParam);
    return synthSubject(presParam, missions);
  }, [presQ.data, cmdsQ.data, presParam]);

  const subjectId = subject?.id ?? '';
  const subjectName = subject?.name ?? '';

  const reviewsQ = useReviews(subjectId || undefined);
  const kycKey = 'pres:' + subjectId;
  const kycQ = useKyc(subjectId ? kycKey : '');
  const contract = useContractsStore((s) => (subjectId ? s.contracts[subjectId] : undefined));
  const selected = useSelectionStore((s) => s.selected);

  const missions = useMemo(
    () => (cmdsQ.data ?? []).filter((c) => c.prestataire?.name === subjectName),
    [cmdsQ.data, subjectName],
  );

  const st = presStats(reviewsQ.data ?? []);
  const factures = facturesForMissions(missions, t);
  const versements = (creditsQ.data ?? []).filter(
    (r) => r.type === 'vers' && r.benef === subjectName,
  );
  const ouvriers = ouvriersForMissions(missions);
  const statCa = factures.reduce((s, f) => s + f.montantNum, 0);

  // ---------- kyc (server state + local overlay) ----------
  const kycStatus = kycStatusLocal ?? kycQ.data?.status ?? 'pending';
  const kycMotif = kycMotifLocal ?? kycQ.data?.motif ?? '';
  const kycDocs = (kycQ.data?.docs ?? []).map((d) =>
    kycDocNames[d.id] ? { ...d, name: kycDocNames[d.id] ?? d.name } : d,
  );
  const kycAudit = [...kycLocalAudit, ...(kycQ.data?.audit ?? [])];

  const setKycStatus = (status: KycStatus) => {
    const lbl = KYC_LABEL_FR[status];
    setKycStatusLocal(status);
    setKycLocalAudit((prev) => [
      {
        who: 'Karim',
        action: 'Statut → ' + lbl + (kycMotif ? ' (' + kycMotif + ')' : ''),
        date: nowStamp(),
      },
      ...prev,
    ]);
    toast.success(t('commonKycToastStatut').replace('{n}', lbl));
  };

  const replaceKycDoc = (docId: string, fileName: string) => {
    setKycDocNames((prev) => ({ ...prev, [docId]: fileName }));
    setKycLocalAudit((prev) => [
      { who: 'Karim', action: 'Remplacement document · ' + fileName, date: nowStamp() },
      ...prev,
    ]);
    toast.success(t('docToastRemplace'));
  };

  const openPiece = (title: string, fileName: string) => setPiece({ title, fileName });

  // logic.ts viewAsPres
  const viewAsPres = () => {
    uiActions.setRoleView('prestataire');
    toast.success(t('presToastVuePrestataire'));
    onClose();
    navigate('/commandes');
  };

  // logic.ts addCandidate
  const addCandidate = () => {
    if (!selected.includes(subjectId)) selectionActions.toggle(subjectId);
    toast.success(t('presToastAjouteCandidats'));
  };

  // logic.ts openCmdFromFiche
  const openCmd = (id: string) => {
    onClose();
    navigate('/commandes/' + id);
  };

  // ---------- header derivations (logic.ts renderVals profile) ----------
  const fam = subject ? (catMeta(subject.cat)?.fam ?? 'NOIR') : 'NOIR';
  const famColor = FAM_COLOR[fam];
  const co = subject ? catMeta(subject.cat) : null;
  const rating = subject ? (st.avg || subject.rating || 0).toFixed(1) : '0.0';
  const reviewCount = subject ? st.count || subject.reviews : 0;
  const signed = contract?.status === 'signed';

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
          {!subject ? (
            <div className="px-4 py-6 sm:px-[26px]">
              {presQ.isError ? <ErrorBlock /> : <PanelSkeleton rows={4} />}
            </div>
          ) : (
            <>
              {/* ---------- header ---------- */}
              <div className="border-b border-de9-line px-4 py-6 sm:px-[26px]">
                <div className="flex items-center gap-3.5">
                  <div
                    className="flex h-14 w-14 flex-none items-center justify-center rounded-[15px] text-[18px] font-extrabold text-white"
                    style={{ background: famColor }}
                  >
                    {subject.init}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <DialogTitle className="font-sans text-[19px] leading-normal font-extrabold text-de9-ink">
                        {subject.name}
                      </DialogTitle>
                      <span
                        className="rounded-full px-2 py-[3px] text-[10px] font-extrabold text-white"
                        style={{ background: famColor }}
                      >
                        {FAM_LABEL[fam]}
                      </span>
                      {subject.kyc && (
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
                      ★ {rating} · {reviewCount} {t('surNAvis')} · {subject.missions}{' '}
                      {t('presMissionsCount')} · {subject.sat}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-[9px]">
                  <a
                    href={'tel:+213' + subject.phone.replace(/^0/, '')}
                    className="min-w-[90px] flex-1 rounded-xl border-[1.5px] border-de9-line bg-card py-[11px] text-center text-[12.5px] font-bold text-de9-slate no-underline"
                  >
                    📞 {t('tel')}
                  </a>
                  <a
                    href={'https://wa.me/' + subject.wa}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-[90px] flex-1 rounded-xl border-[1.5px] border-de9-line bg-card py-[11px] text-center text-[12.5px] font-bold text-de9-slate no-underline"
                  >
                    💬 WhatsApp
                  </a>
                  <a
                    href={'mailto:' + subject.email}
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
                        style={{ color: fam === 'NOIR' ? undefined : famColor }}
                      >
                        {co ? co.icon + ' ' : ''}
                        {co ? l(co.fr, co.ar) : '—'}
                      </div>
                      <div className="mt-[2px] text-[12.5px] text-de9-slate">
                        {subject.subs.join(' · ') || '—'}
                      </div>
                      <div className="mt-[2px] text-[12.5px] text-de9-slate">
                        📍 {subject.wilayas.join(', ') || '—'}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      <div className="rounded-xl bg-secondary p-3 text-center">
                        <div className="text-[16px] font-extrabold">{subject.effectif}</div>
                        <div className="text-[10px] text-de9-gray">{t('presEquipe')}</div>
                      </div>
                      <div className="rounded-xl bg-secondary p-3 text-center">
                        <div className="text-[16px] font-extrabold">
                          {subject.anc} {t('presAns')}
                        </div>
                        <div className="text-[10px] text-de9-gray">{t('presAnciennete')}</div>
                      </div>
                      <div className="rounded-xl bg-secondary p-3 text-center">
                        <div className="text-[16px] font-extrabold">
                          {tarifLabel(subject.tarif) || '—'}
                        </div>
                        <div className="text-[10px] text-de9-gray">{t('presTarifs')}</div>
                      </div>
                    </div>
                    {subject.certs.length > 0 && (
                      <div>
                        <SectionLabel>{t('presCertifications')}</SectionLabel>
                        <div className="mt-[7px] flex flex-wrap gap-[7px]">
                          {subject.certs.map((ct, i) => (
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
                        {subject.langues.join(', ') || '—'}
                      </div>
                    </div>
                    {subject.refs.length > 0 && (
                      <div>
                        <SectionLabel>{t('presMissionsPassees')}</SectionLabel>
                        <div className="mt-[7px] flex flex-col gap-[7px]">
                          {subject.refs.map((rf, i) => (
                            <div key={i} className="flex items-center gap-[9px] text-[12.5px]">
                              <span className="h-[7px] w-[7px] flex-none rounded-full bg-de9-teal" />
                              <b>{rf.client}</b>
                              <span className="text-de9-gray">· {rf.service}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* KYC */}
                {tab === 'kyc' &&
                  (kycQ.isPending ? (
                    <PanelSkeleton />
                  ) : kycQ.isError ? (
                    <ErrorBlock />
                  ) : (
                    <KycPanel
                      kycKey={kycKey}
                      status={kycStatus}
                      motif={kycMotif}
                      docs={kycDocs}
                      audit={kycAudit}
                      onStatusChange={setKycStatus}
                      onMotifChange={setKycMotifLocal}
                      onReplaceDoc={replaceKycDoc}
                      onOpenPiece={openPiece}
                    />
                  ))}

                {/* CONTRAT */}
                {tab === 'contrat' && <ContratPanel presId={subjectId} onOpenPiece={openPiece} />}

                {/* MISSIONS */}
                {tab === 'missions' &&
                  (cmdsQ.isPending ? (
                    <PanelSkeleton />
                  ) : cmdsQ.isError ? (
                    <ErrorBlock />
                  ) : (
                    <div className="flex flex-col gap-[9px]">
                      {missions.map((c) => {
                        const ms = missionLine(c, t);
                        return (
                          <button
                            key={ms.id}
                            type="button"
                            onClick={() => openCmd(ms.id)}
                            className="flex cursor-pointer items-center gap-[11px] rounded-[13px] border-[1.5px] border-de9-line bg-card px-3.5 py-3 text-start"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-[13px] font-bold">
                                {ms.id} · {ms.service}
                              </div>
                              <div className="text-[11.5px] text-de9-gray">
                                {ms.client} · {ms.date} {ms.occLabel}
                              </div>
                            </div>
                            <span
                              className="rounded-full px-2.5 py-[5px] text-[10.5px] font-bold"
                              style={{ background: ms.status.bg, color: ms.status.fg }}
                            >
                              {ms.status.label}
                            </span>
                            <span className="text-[15px] text-de9-gray">›</span>
                          </button>
                        );
                      })}
                      {missions.length === 0 && <EmptyState />}
                    </div>
                  ))}

                {/* FACTURES */}
                {tab === 'factures' &&
                  (cmdsQ.isPending ? (
                    <PanelSkeleton />
                  ) : cmdsQ.isError ? (
                    <ErrorBlock />
                  ) : (
                    <div className="flex flex-col gap-[9px]">
                      {factures.map((fc, i) => (
                        <div
                          key={i}
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
                            <div className="text-[11px] text-de9-gray">{fc.date}</div>
                          </div>
                          <span
                            className="rounded-full px-2.5 py-[5px] text-[10.5px] font-bold"
                            style={{ background: fc.status.bg, color: fc.status.fg }}
                          >
                            {fc.status.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => openPiece(fc.title, fc.file)}
                            className="flex-none cursor-pointer rounded-[9px] bg-de9-ink px-[11px] py-[7px] text-[11px] font-bold text-white dark:text-[#151923]"
                          >
                            {t('voir')}
                          </button>
                        </div>
                      ))}
                      {factures.length === 0 && <EmptyState />}
                    </div>
                  ))}

                {/* VERSEMENTS */}
                {tab === 'versements' &&
                  (creditsQ.isPending ? (
                    <PanelSkeleton />
                  ) : creditsQ.isError ? (
                    <ErrorBlock />
                  ) : (
                    <div className="flex flex-col gap-[9px]">
                      <div className="text-[11.5px] text-de9-gray">{t('part85')}</div>
                      {versements.map((vs, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-[11px] rounded-[13px] border-[1.5px] border-de9-line px-3.5 py-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-extrabold text-[#2FA86A] dark:text-[#6FCF97]">
                              +{fmtMoney(Math.abs(vs.credits))}{' '}
                              <span className="text-[10px] font-semibold text-de9-gray">
                                {t('credits')}
                              </span>
                            </div>
                            <div className="text-[11px] text-de9-gray">
                              {vs.ref} · {withDay(vs.date, t)}
                            </div>
                          </div>
                          <span className="flex-none rounded-full bg-[#E7F6EE] px-[9px] py-1 text-[10px] font-extrabold text-[#2FA86A] dark:bg-[#2FA86A]/15 dark:text-[#6FCF97]">
                            {t('transfere')}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              openPiece(
                                t('factureServicePresta') + ' — ' + subjectName,
                                'facture-service-F-' + vs.cmdRef.replace(/[^0-9]/g, '') + '.pdf',
                              )
                            }
                            className="flex-none cursor-pointer rounded-[9px] bg-[#EAF2FD] px-[11px] py-[7px] text-[11px] font-bold text-[#2F7FD0] dark:bg-[#2F7FD0]/15 dark:text-[#7EB5EC]"
                          >
                            🧾 {t('voir')}
                          </button>
                        </div>
                      ))}
                      {versements.length === 0 && <EmptyState />}
                    </div>
                  ))}

                {/* AVIS */}
                {tab === 'avis' &&
                  (reviewsQ.isPending ? (
                    <PanelSkeleton />
                  ) : reviewsQ.isError ? (
                    <ErrorBlock />
                  ) : (
                    <AvisPanel
                      presId={subjectId}
                      fallbackRating={subject.rating}
                      onAddReview={() => setReviewOpen(true)}
                    />
                  ))}

                {/* ÉQUIPE */}
                {tab === 'equipe' &&
                  (cmdsQ.isPending ? (
                    <PanelSkeleton />
                  ) : cmdsQ.isError ? (
                    <ErrorBlock />
                  ) : (
                    <div className="flex flex-col gap-[9px]">
                      {ouvriers.map((ov) => (
                        <div
                          key={ov.name}
                          className="flex items-center gap-[11px] rounded-[13px] border-[1.5px] border-de9-line px-3.5 py-[11px]"
                        >
                          <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-de9-ink text-[13px] font-bold text-white dark:text-[#151923]">
                            {ov.init}
                          </div>
                          <div className="flex-1 text-[13px] font-bold">{ov.name}</div>
                          <span className="text-[15px] text-de9-gray">›</span>
                        </div>
                      ))}
                      {ouvriers.length === 0 && <EmptyState />}
                    </div>
                  ))}

                {/* STATS */}
                {tab === 'stats' &&
                  (cmdsQ.isPending ? (
                    <PanelSkeleton rows={2} />
                  ) : cmdsQ.isError ? (
                    <ErrorBlock />
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <div className="rounded-[14px] bg-secondary p-[15px]">
                        <div className="text-[19px] font-extrabold">
                          {fmtMoney(statCa)}{' '}
                          <span className="text-[11px] text-de9-gray">{t('credits')}</span>
                        </div>
                        <div className="mt-[3px] text-[11px] text-de9-gray">{t('statCA')}</div>
                      </div>
                      <div className="rounded-[14px] bg-secondary p-[15px]">
                        <div className="text-[19px] font-extrabold">{missions.length}</div>
                        <div className="mt-[3px] text-[11px] text-de9-gray">
                          {t('statMissionsL')}
                        </div>
                      </div>
                      <div className="rounded-[14px] bg-secondary p-[15px]">
                        <div className="text-[19px] font-extrabold text-[#2FA86A] dark:text-[#6FCF97]">
                          {subject.sat}
                        </div>
                        <div className="mt-[3px] text-[11px] text-de9-gray">{t('statSatL')}</div>
                      </div>
                      <div className="rounded-[14px] bg-secondary p-[15px]">
                        <div className="text-[19px] font-extrabold">{subject.delai}</div>
                        <div className="mt-[3px] text-[11px] text-de9-gray">
                          {t('statDelaiL')}
                        </div>
                      </div>
                    </div>
                  ))}
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
                presId={subjectId}
                presName={subjectName}
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
