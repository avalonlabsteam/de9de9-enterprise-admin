// Client fiche overlay — ported from src/admin/views/ClientFiche.tsx +
// logic.ts buildClientFiche. Opened via the '?client=' search param
// (URI-encoded client name); closing clears the param.
import { useMemo, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { useL, useT } from '@/lib/i18n';
import { uiActions } from '@/stores/uiStore';
import { useClientKyc, useCommandes, useCredits, useFactures } from '../api/clients';
import type { FicheKycAuditEntry, FicheKycStatus } from '../api/clients';
import {
  KYC_LABEL_FR,
  clientInit,
  cmdLine,
  docsFromRecharges,
  factureLine,
  kycMeta,
  moveLine,
  nowStamp,
  rechargeLine,
} from '../lib/fiche';
import { KycTab } from './KycTab';
import { PieceViewer } from './PieceViewer';
import type { PieceView } from './PieceViewer';

type ClientTab = 'infos' | 'kyc' | 'commandes' | 'factures' | 'credits' | 'documents';

/** Reads '?client=' and renders the client fiche overlay; closing clears the param. */
export function ClientFicheHost() {
  const [searchParams, setSearchParams] = useSearchParams();
  const client = searchParams.get('client');

  const close = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('client');
      return next;
    });
  };

  if (!client) return null;
  return <ClientFiche key={client} name={client} onClose={close} />;
}

// ---------- shared bits ----------

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 text-[11px] font-extrabold tracking-[.04em] text-de9-gray uppercase">
      {children}
    </div>
  );
}

function EmptyState({ small }: { small?: boolean }) {
  const t = useT();
  return (
    <div
      className={cn(
        'text-center text-de9-gray',
        small ? 'p-3 text-xs' : 'p-4 text-[12.5px]',
      )}
    >
      {t('aucuneDonnee')}
    </div>
  );
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

// ---------- fiche ----------

function ClientFiche({ name, onClose }: { name: string; onClose: () => void }) {
  const t = useT();
  const navigate = useNavigate();

  const [tab, setTab] = useState<ClientTab>('infos');
  const [piece, setPiece] = useState<PieceView | null>(null);

  // KYC status / motif / replaced doc names have no API endpoint — they stay
  // client-side exactly like the prototype's local state (logic.ts setKycStatus,
  // setKycMotif, replaceKycDoc), layered over the fetched KYC state.
  const [kycStatusLocal, setKycStatusLocal] = useState<FicheKycStatus | null>(null);
  const [kycMotifLocal, setKycMotifLocal] = useState<string | null>(null);
  const [kycLocalAudit, setKycLocalAudit] = useState<FicheKycAuditEntry[]>([]);
  const [kycDocNames, setKycDocNames] = useState<Record<string, string>>({});

  const commandesQ = useCommandes();
  const creditsQ = useCredits();
  const facturesQ = useFactures();
  const kycQ = useClientKyc(name);

  const cmds = useMemo(
    () => (commandesQ.data ?? []).filter((c) => c.client === name),
    [commandesQ.data, name],
  );
  const first = cmds[0];

  const myCredits = useMemo(
    () => (creditsQ.data ?? []).filter((r) => r.client === name),
    [creditsQ.data, name],
  );
  const balRow = myCredits.find((r) => r.solde && r.solde !== '—');
  const balance = balRow ? balRow.solde : '—';

  const cmdsList = cmds.map((c) => cmdLine(c, t));
  const factures = (facturesQ.data ?? [])
    .filter((f) => f.client === name)
    .map((f) => factureLine(f, t));
  const recharges = myCredits.filter((r) => r.type === 'rech').map((r) => rechargeLine(r, t));
  const moves = myCredits.map((r) => moveLine(r, t));
  const docsList = docsFromRecharges(recharges);

  const kycStatus = kycStatusLocal ?? kycQ.data?.status ?? 'pending';
  const kycMotif = kycMotifLocal ?? kycQ.data?.motif ?? '';
  const kycDocs = (kycQ.data?.docs ?? []).map((d) =>
    kycDocNames[d.id] ? { ...d, name: kycDocNames[d.id] ?? d.name } : d,
  );
  const kycAudit = [...kycLocalAudit, ...(kycQ.data?.audit ?? [])];
  const headerKyc = kycMeta(kycStatus, t);

  const setKycStatus = (st: FicheKycStatus) => {
    const lbl = KYC_LABEL_FR[st];
    setKycStatusLocal(st);
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

  const viewAsClient = () => {
    uiActions.setRoleView('client');
    toast.success(t('clientToastVueClient'));
    onClose();
  };

  const addDocSim = (e: ChangeEvent<HTMLInputElement>) => {
    // Simulated upload — logic.ts addDocSim (toast only).
    if (!e.target.files?.length) return;
    e.target.value = '';
    toast.success(t('docToastAjoute'));
  };

  const openPiece = (title: string, fileName: string, documentId?: string | null) =>
    setPiece({ title, fileName, documentId });

  const tel = first?.phone ? 'tel:+213' + first.phone.replace(/^0/, '') : '#';
  const wa = first?.phone ? 'https://wa.me/213' + first.phone.replace(/^0/, '') : '#';
  const mail = first?.clientEmail ? 'mailto:' + first.clientEmail : '#';

  const tabs: { key: ClientTab; label: string }[] = [
    { key: 'infos', label: t('commonTabInfos') },
    { key: 'kyc', label: 'KYC' },
    { key: 'commandes', label: t('navCommandes') },
    { key: 'factures', label: t('navFactures') },
    { key: 'credits', label: t('clientTabCredits') },
    { key: 'documents', label: t('kycDocs') },
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
            if (piece) e.preventDefault();
          }}
          className="fixed start-1/2 top-1/2 z-[92] max-h-[90vh] w-full max-w-[560px] -translate-x-1/2 -translate-y-1/2 animate-sheet-up overflow-y-auto rounded-[22px] bg-card text-de9-ink shadow-[0_30px_70px_rgba(20,30,45,.35)] outline-none sm:w-[calc(100%-48px)] rtl:translate-x-1/2"
        >
          {/* ---------- header ---------- */}
          <div className="border-b border-de9-line px-4 py-6 sm:px-[26px]">
            <div className="flex items-center gap-3.5">
              <div className="flex h-14 w-14 flex-none items-center justify-center rounded-[15px] bg-[#2F7FD0] text-[18px] font-extrabold text-white">
                {clientInit(name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle className="font-sans text-[19px] leading-normal font-extrabold text-de9-ink">
                    {name}
                  </DialogTitle>
                  <span
                    className="rounded-full px-2 py-[3px] text-[10px] font-extrabold"
                    style={{ background: headerKyc.bg, color: headerKyc.fg }}
                  >
                    {headerKyc.icon} KYC
                  </span>
                </div>
                <div className="mt-[3px] text-[12.5px] text-de9-gray">
                  {first?.service ?? '—'} · 📍 {first?.wilaya ?? '—'}
                </div>
              </div>
              <div className="flex-none text-end">
                <div className="text-[17px] font-extrabold text-de9-teal-dark">{balance}</div>
                <div className="text-[10px] text-de9-gray">{t('soldeCredits')}</div>
              </div>
            </div>
            <div className="mt-4 flex gap-[9px]">
              <a
                href={tel}
                className="flex-1 rounded-xl border-[1.5px] border-de9-line bg-card py-[11px] text-center text-[12.5px] font-bold text-de9-slate no-underline"
              >
                📞 Tél
              </a>
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="flex-1 rounded-xl border-[1.5px] border-de9-line bg-card py-[11px] text-center text-[12.5px] font-bold text-de9-slate no-underline"
              >
                💬 WhatsApp
              </a>
              <a
                href={mail}
                className="flex-1 rounded-xl border-[1.5px] border-de9-line bg-card py-[11px] text-center text-[12.5px] font-bold text-de9-slate no-underline"
              >
                ✉️ Email
              </a>
            </div>
            <button
              type="button"
              onClick={viewAsClient}
              className="mt-[9px] w-full cursor-pointer rounded-xl bg-[#EAF2FD] py-[11px] text-center text-[12.5px] font-bold text-[#2F7FD0] dark:bg-[#2F7FD0]/15 dark:text-[#7EB5EC]"
            >
              👁 {t('voirEnTantClient')}
            </button>
          </div>

          {/* ---------- tab bar ---------- */}
          <div className="flex gap-1.5 overflow-x-auto border-b border-de9-line px-5 pt-3 whitespace-nowrap">
            {tabs.map((tb) => (
              <button
                key={tb.key}
                type="button"
                onClick={() => setTab(tb.key)}
                className={cn(
                  'flex-none cursor-pointer rounded-t-[10px] px-[13px] py-[9px] text-xs font-bold',
                  tab === tb.key ? 'bg-[#232838] text-white' : 'bg-card text-de9-slate',
                )}
              >
                {tb.label}
              </button>
            ))}
          </div>

          {/* ---------- body ---------- */}
          <div className="flex flex-col gap-4 px-4 py-5 sm:px-[26px]">
            {/* INFOS */}
            {tab === 'infos' &&
              (commandesQ.isPending ? (
                <PanelSkeleton />
              ) : commandesQ.isError ? (
                <ErrorBlock />
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <div className="rounded-xl bg-secondary px-3.5 py-3">
                      <div className="text-[10.5px] font-extrabold text-de9-gray uppercase">
                        {t('cContact')}
                      </div>
                      <div className="mt-[3px] text-[13px] font-bold">{first?.contact ?? '—'}</div>
                      <div className="text-[11.5px] text-de9-slate">{first?.phone ?? '—'}</div>
                    </div>
                    <div className="rounded-xl bg-secondary px-3.5 py-3">
                      <div className="text-[10.5px] font-extrabold text-de9-gray uppercase">
                        {t('cSecteur')}
                      </div>
                      <div className="mt-[3px] text-[13px] font-bold">{first?.service ?? '—'}</div>
                    </div>
                    <div className="rounded-xl bg-secondary px-3.5 py-3">
                      <div className="text-[10.5px] font-extrabold text-de9-gray uppercase">
                        {t('cAdresse')}
                      </div>
                      <div className="mt-[3px] text-[13px] font-bold">{first?.wilaya ?? '—'}</div>
                      <div className="text-[11.5px] text-de9-slate">{first?.commune ?? '—'}</div>
                    </div>
                    <div className="min-w-0 rounded-xl bg-secondary px-3.5 py-3">
                      <div className="text-[10.5px] font-extrabold text-de9-gray uppercase">Email</div>
                      <div className="mt-[3px] truncate text-xs font-bold">
                        {first?.clientEmail ?? '—'}
                      </div>
                    </div>
                  </div>
                  <div className="text-[11.5px] text-de9-gray">
                    {t('cIdent')} — RC / NIF / NIS : {t('kycDocs')} (KYC)
                  </div>
                </div>
              ))}

            {/* KYC */}
            {tab === 'kyc' &&
              (kycQ.isPending ? (
                <PanelSkeleton />
              ) : kycQ.isError ? (
                <ErrorBlock />
              ) : (
                <KycTab
                  name={name}
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

            {/* COMMANDES */}
            {tab === 'commandes' &&
              (commandesQ.isPending ? (
                <PanelSkeleton />
              ) : commandesQ.isError ? (
                <ErrorBlock />
              ) : (
                <div className="flex flex-col gap-[9px]">
                  {cmdsList.map((cm) => (
                    <button
                      key={cm.id}
                      type="button"
                      onClick={() => navigate('/commandes/' + cm.id)}
                      className="flex cursor-pointer items-center gap-[11px] rounded-[13px] border-[1.5px] border-de9-line px-3.5 py-3 text-start"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-bold">
                          {cm.id} · {cm.service}
                        </div>
                        <div className="text-[11.5px] text-de9-gray">
                          {cm.pres} · {cm.date} {cm.occLabel}
                        </div>
                      </div>
                      <span
                        className="flex-none rounded-full px-2.5 py-[5px] text-[10.5px] font-bold whitespace-nowrap"
                        style={{ background: cm.status.bg, color: cm.status.fg }}
                      >
                        {cm.status.label}
                      </span>
                      <span className="text-[15px] text-de9-gray">›</span>
                    </button>
                  ))}
                  {cmdsList.length === 0 && <EmptyState />}
                </div>
              ))}

            {/* FACTURES */}
            {tab === 'factures' &&
              (facturesQ.isPending ? (
                <PanelSkeleton />
              ) : facturesQ.isError ? (
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
                        <div className="text-[11px] text-de9-gray">
                          {fc.pres} · {fc.date}
                        </div>
                      </div>
                      <span
                        className="flex-none rounded-full px-2.5 py-[5px] text-[10.5px] font-bold whitespace-nowrap"
                        style={{ background: fc.status.bg, color: fc.status.fg }}
                      >
                        {fc.status.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => openPiece(fc.title, fc.file)}
                        className="flex-none cursor-pointer rounded-[9px] bg-[#232838] px-[11px] py-[7px] text-[11px] font-bold text-white"
                      >
                        {t('voir')}
                      </button>
                    </div>
                  ))}
                  {factures.length === 0 && <EmptyState />}
                </div>
              ))}

            {/* CRÉDITS */}
            {tab === 'credits' &&
              (creditsQ.isPending ? (
                <PanelSkeleton />
              ) : creditsQ.isError ? (
                <ErrorBlock />
              ) : (
                <div className="flex flex-col gap-3.5">
                  <div className="rounded-2xl bg-[#232838] px-[18px] py-4 text-white">
                    <div className="text-[11px] font-semibold text-[#AEB6C2]">{t('soldeCredits')}</div>
                    <div className="mt-[2px] text-[26px] font-extrabold">
                      {balance} <span className="text-xs text-de9-gray">{t('credits')}</span>
                    </div>
                  </div>
                  <div>
                    <SectionLabel>{t('rechargeTitle')}</SectionLabel>
                    <div className="flex flex-col gap-2">
                      {recharges.map((rc, i) => (
                        <div key={i} className="rounded-xl border-[1.5px] border-de9-line px-[13px] py-[11px]">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-[12.5px] font-bold">
                              +{rc.montant}{' '}
                              <span className="text-[10px] text-de9-gray">{t('credits')}</span>
                            </div>
                            <div className="text-[11px] text-de9-gray">
                              {rc.ref} · {rc.date}
                            </div>
                          </div>
                          <div className="mt-[7px] flex flex-wrap gap-1.5">
                            {rc.justif && (
                              <button
                                type="button"
                                onClick={() => openPiece(rc.justifTitle, rc.justifName)}
                                className="cursor-pointer rounded-full bg-[#E7F6EE] px-[9px] py-1 text-[10px] font-bold text-de9-teal-dark dark:bg-[#2FA86A]/15"
                              >
                                🧾 {t('justifCourt')}
                              </button>
                            )}
                            {rc.facture && (
                              <button
                                type="button"
                                onClick={() => openPiece(rc.factTitle, rc.factName)}
                                className="cursor-pointer rounded-full bg-[#E7F6EE] px-[9px] py-1 text-[10px] font-bold text-de9-teal-dark dark:bg-[#2FA86A]/15"
                              >
                                🧾 {t('factureCourt')}
                              </button>
                            )}
                            {rc.refBadge && (
                              <span className="rounded-full bg-[#FBF4E4] px-[9px] py-1 text-[10px] font-bold text-[#B68A2E] dark:bg-[#B68A2E]/15 dark:text-[#D9B36A]">
                                ⚠ {rc.refBadge}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {recharges.length === 0 && <EmptyState small />}
                    </div>
                  </div>
                  <div>
                    <SectionLabel>{t('historiqueCredits')}</SectionLabel>
                    <div className="flex flex-col gap-1.5">
                      {moves.map((mv, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-2 rounded-[10px] bg-secondary px-3 py-[9px]"
                        >
                          <div className="text-xs">
                            <b>{mv.label}</b>{' '}
                            <span className="text-de9-gray">
                              · {mv.ref} · {mv.date}
                            </span>
                          </div>
                          <div className="text-[12.5px] font-extrabold" style={{ color: mv.color }}>
                            {mv.montant}
                          </div>
                        </div>
                      ))}
                      {moves.length === 0 && <EmptyState small />}
                    </div>
                  </div>
                </div>
              ))}

            {/* DOCUMENTS */}
            {tab === 'documents' &&
              (creditsQ.isPending ? (
                <PanelSkeleton />
              ) : creditsQ.isError ? (
                <ErrorBlock />
              ) : (
                <div className="flex flex-col gap-[9px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] font-extrabold tracking-[.04em] text-de9-gray uppercase">
                      {t('docsLies')}
                    </div>
                    <label className="cursor-pointer rounded-[9px] bg-[#E5F7F4] px-3 py-[7px] text-[11.5px] font-bold text-de9-teal-dark dark:bg-[#2AB3A8]/15">
                      ＋ {t('ajouterDocClient')}
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={addDocSim}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {docsList.map((dl, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 rounded-xl border-[1.5px] border-de9-line px-[13px] py-[11px]"
                    >
                      <span className="flex-none text-[17px]">📄</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] font-bold text-de9-ink">{dl.title}</div>
                        <div className="truncate text-[10.5px] text-de9-gray">{dl.file}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openPiece(dl.title, dl.file)}
                        className="flex-none cursor-pointer rounded-[9px] bg-[#232838] px-[11px] py-[7px] text-[11px] font-bold text-white"
                      >
                        {t('voir')}
                      </button>
                    </div>
                  ))}
                  {docsList.length === 0 && <EmptyState />}
                </div>
              ))}
          </div>

          {/* ---------- footer ---------- */}
          <div className="px-4 pt-4 pb-6 sm:px-[26px]">
            <button
              type="button"
              onClick={onClose}
              className="w-full cursor-pointer rounded-[13px] bg-secondary py-[13px] text-center text-[13.5px] font-bold text-de9-slate"
            >
              {t('fermer')}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>

      <PieceViewer piece={piece} onClose={() => setPiece(null)} />
    </Dialog>
  );
}
