// Client fiche overlay — ported from src/admin/views/ClientFiche.tsx +
// logic.ts buildClientFiche. Opened via the '?client=' search param
// (URI-encoded client name); closing clears the param.
import { useMemo, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { toast } from 'sonner';
import {
  ArrowRight,
  Eye,
  FileText,
  Mail,
  MapPin,
  MessageCircle,
  Plus,
  ReceiptText,
  TriangleAlert,
} from 'lucide-react';
import { cn, isLiveId } from '@/lib/utils';
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { Glyph } from '@/components/common/Glyph';
import { PhoneNumber } from '@/components/common/PhoneNumber';
import { useL, useT } from '@/lib/i18n';
import { uiActions } from '@/stores/uiStore';
import { useKycCompanyIdByName, useKycRevue } from '@/features/kyc/api/kyc';
import { KycDossierPanel } from '@/features/kyc/components/KycDossierPanel';
import { useCommandes, useCredits, useFactures } from '../api/clients';
import {
  clientInit,
  cmdLine,
  docsFromRecharges,
  factureLine,
  kycMeta,
  moveLine,
  rechargeLine,
} from '../lib/fiche';
import { PieceViewer } from './PieceViewer';
import type { PieceView } from './PieceViewer';

type ClientTab = 'infos' | 'kyc' | 'commandes' | 'factures' | 'credits' | 'documents';

/**
 * An alert's `?onglet=` (guide 11a §6, adm.entreprise) → the tab the fiche
 * opens on. Legal documents live in the KYC tab (the « Documents » tab holds
 * recharge proofs); another page's `onglet` maps to nothing.
 */
const TAB_BY_ONGLET: Partial<Record<string, ClientTab>> = {
  credits: 'credits',
  documents: 'kyc',
};

/** Reads '?client=' and renders the client fiche overlay; closing clears the param. */
export function ClientFicheHost() {
  const [searchParams, setSearchParams] = useSearchParams();
  const client = searchParams.get('client');
  const initialTab = TAB_BY_ONGLET[searchParams.get('onglet') ?? ''] ?? 'infos';

  const close = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('client');
      return next;
    });
  };

  // A company id is another page's filter (Comptabilité's ?client=<companyId>), never a client name.
  if (!client || isLiveId(client)) return null;
  return <ClientFiche key={client} name={client} initialTab={initialTab} onClose={close} />;
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

// ---------- fiche ----------

function ClientFiche({
  name,
  initialTab,
  onClose,
}: {
  name: string;
  initialTab: ClientTab;
  onClose: () => void;
}) {
  const t = useT();
  const navigate = useNavigate();

  const [tab, setTab] = useState<ClientTab>(initialTab);
  const [piece, setPiece] = useState<PieceView | null>(null);

  const commandesQ = useCommandes();
  const creditsQ = useCredits();
  const facturesQ = useFactures();

  const cmds = useMemo(
    () => (commandesQ.data ?? []).filter((c) => c.client === name),
    [commandesQ.data, name],
  );
  const first = cmds[0];

  const myCredits = useMemo(
    () => (creditsQ.data ?? []).filter((r) => r.client === name),
    [creditsQ.data, name],
  );
  // Live ledger rows carry the client's company id: the « Paiements à vérifier » link filters on it.
  const companyId = myCredits.map((r) => r['clientId']).find((v): v is string => typeof v === 'string' && !!v);
  const balRow = myCredits.find((r) => r.solde && r.solde !== '—');
  const balance = balRow ? balRow.solde : '—';

  const cmdsList = cmds.map((c) => cmdLine(c, t));
  const factures = (facturesQ.data ?? [])
    .filter((f) => f.client === name)
    .map((f) => factureLine(f, t));
  const recharges = myCredits.filter((r) => r.type === 'rech').map((r) => rechargeLine(r, t));
  const moves = myCredits.map((r) => moveLine(r, t));
  const docsList = docsFromRecharges(recharges);

  // ---------- kyc: the company's real dossier, decided piece by piece ----------
  // The fiche opens by name and the dossier is keyed by company id: the ledger
  // rows give it for most clients, the KYC queue's own search for the others.
  const lookupQ = useKycCompanyIdByName(name, !companyId && !creditsQ.isPending);
  const kycCompanyId = companyId ?? lookupQ.data ?? null;
  const kycResolving = creditsQ.isPending || lookupQ.isLoading;
  const kycRevueQ = useKycRevue(kycCompanyId ?? '');
  const kycStatut = kycRevueQ.data?.statut;
  // No chip rather than a guessed one while the dossier is unknown.
  const headerKyc =
    kycStatut === 'verified' || kycStatut === 'pending' || kycStatut === 'rejected' ? kycMeta(kycStatut, t) : null;

  const openKycReview = () => {
    if (!kycCompanyId) return;
    onClose();
    navigate('/kyc/' + encodeURIComponent(kycCompanyId));
  };

  const searchKycQueue = () => {
    onClose();
    navigate('/kyc?q=' + encodeURIComponent(name));
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
          className="fixed start-1/2 top-1/2 z-[92] max-h-[90vh] w-full max-w-[560px] -translate-x-1/2 -translate-y-1/2 animate-sheet-up overflow-y-auto rounded-xl bg-card text-de9-ink shadow-e3 outline-none sm:w-[calc(100%-48px)] rtl:translate-x-1/2"
        >
          {/* ---------- header ---------- */}
          <div className="border-b border-de9-line px-4 py-6 sm:px-[26px]">
            <div className="flex items-center gap-3.5">
              <div className="flex h-14 w-14 flex-none items-center justify-center rounded-md bg-[#2F7FD0] text-[18px] font-extrabold text-white">
                {clientInit(name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle className="font-sans text-[19px] leading-normal font-extrabold text-de9-ink">
                    {name}
                  </DialogTitle>
                  {headerKyc && (
                    <span
                      title={headerKyc.label}
                      className="rounded-full px-2 py-[3px] text-[10px] font-extrabold tone-chip"
                      style={{ background: headerKyc.bg, color: headerKyc.fg }}
                    >
                      <Glyph icon={headerKyc.icon} /> KYC
                    </span>
                  )}
                </div>
                <div className="mt-[3px] text-[12.5px] text-de9-gray">
                  {first?.service ?? '—'} · <Glyph icon={MapPin} /> {first?.wilaya ?? '—'}
                </div>
              </div>
              <div className="flex-none text-end">
                <div className="text-[17px] font-extrabold text-de9-teal-dark">
                  <span className="num">{balance}</span>
                </div>
                <div className="text-[10px] text-de9-gray">{t('soldeCredits')}</div>
              </div>
            </div>
            <div className="mt-4 flex gap-[9px]">
              {/* The number itself, to read or copy — not a call link. */}
              <PhoneNumber value={first?.phone} className="flex-1 py-[11px] text-[12.5px] font-bold text-de9-ink" />
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="flex-1 rounded-full border border-de9-line bg-card py-[11px] text-center text-[12.5px] font-bold text-de9-slate no-underline"
              >
                <Glyph icon={MessageCircle} /> WhatsApp
              </a>
              <a
                href={mail}
                className="flex-1 rounded-full border border-de9-line bg-card py-[11px] text-center text-[12.5px] font-bold text-de9-slate no-underline"
              >
                <Glyph icon={Mail} /> Email
              </a>
            </div>
            <button
              type="button"
              onClick={viewAsClient}
              className="mt-[9px] w-full cursor-pointer rounded-full bg-[#EAF2FD] py-[11px] text-center text-[12.5px] font-bold text-[#2F7FD0] dark:bg-[#2F7FD0]/15 dark:text-[#7EB5EC]"
            >
              <Glyph icon={Eye} /> {t('voirEnTantClient')}
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
                  'flex-none cursor-pointer rounded-t-full px-[13px] py-[9px] text-xs font-bold',
                  tab === tb.key ? 'bg-secondary-container text-on-secondary-container' : 'bg-card text-de9-slate',
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
                    <div className="rounded-md bg-secondary px-3.5 py-3">
                      <div className="text-[10.5px] font-extrabold text-de9-gray uppercase">
                        {t('cContact')}
                      </div>
                      <div className="mt-[3px] text-[13px] font-bold">{first?.contact ?? '—'}</div>
                      <div className="text-[11.5px] text-de9-slate">{first?.phone ?? '—'}</div>
                    </div>
                    <div className="rounded-md bg-secondary px-3.5 py-3">
                      <div className="text-[10.5px] font-extrabold text-de9-gray uppercase">
                        {t('cSecteur')}
                      </div>
                      <div className="mt-[3px] text-[13px] font-bold">{first?.service ?? '—'}</div>
                    </div>
                    <div className="rounded-md bg-secondary px-3.5 py-3">
                      <div className="text-[10.5px] font-extrabold text-de9-gray uppercase">
                        {t('cAdresse')}
                      </div>
                      <div className="mt-[3px] text-[13px] font-bold">{first?.wilaya ?? '—'}</div>
                      <div className="text-[11.5px] text-de9-slate">{first?.commune ?? '—'}</div>
                    </div>
                    <div className="min-w-0 rounded-md bg-secondary px-3.5 py-3">
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

            {/* KYC — the real dossier, one verdict per piece */}
            {tab === 'kyc' &&
              (kycCompanyId ? (
                <KycDossierPanel companyId={kycCompanyId} onOpenReview={openKycReview} />
              ) : kycResolving ? (
                <PanelSkeleton />
              ) : (
                <div className="rounded-md bg-secondary px-3.5 py-3 text-[12.5px] text-de9-slate">
                  {t('kycFicheIntrouvable')}
                  <button
                    type="button"
                    onClick={searchKycQueue}
                    className="mt-1.5 block cursor-pointer text-[12.5px] font-bold text-de9-teal-dark hover:underline"
                  >
                    {t('kycChercherFile')} <Glyph icon={ArrowRight} className="rtl:rotate-180" />
                  </button>
                </div>
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
                      className="flex cursor-pointer items-center gap-[11px] rounded-md border border-de9-line px-3.5 py-3 text-start"
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
                        className="flex-none rounded-full px-2.5 py-[5px] text-[10.5px] font-bold whitespace-nowrap tone-chip"
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
                        <div className="text-[11px] text-de9-gray">
                          {fc.pres} · {fc.date}
                        </div>
                      </div>
                      <span
                        className="flex-none rounded-full px-2.5 py-[5px] text-[10.5px] font-bold whitespace-nowrap tone-chip"
                        style={{ background: fc.status.bg, color: fc.status.fg }}
                      >
                        {fc.status.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => openPiece(fc.title, fc.file)}
                        className="flex-none cursor-pointer rounded-full bg-primary px-[11px] py-[7px] text-[11px] font-bold text-primary-foreground"
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
                  <div className="rounded-md bg-[rgb(35_40_56)] px-[18px] py-4 text-white dark:bg-secondary dark:ring-1 dark:ring-de9-line">
                    <div className="text-[11px] font-semibold text-[#AEB6C2]">{t('soldeCredits')}</div>
                    <div className="mt-[2px] text-[26px] font-extrabold">
                      <span className="num">{balance}</span> <span className="text-xs text-de9-gray">{t('credits')}</span>
                    </div>
                  </div>
                  {/* Online card payments waiting on a review (guide 18 §12). */}
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/comptabilite?statut=a_verifier${companyId ? `&client=${encodeURIComponent(companyId)}` : ''}`,
                      )
                    }
                    className="cursor-pointer self-start text-[12.5px] font-bold text-de9-teal-dark hover:underline"
                  >
                    {t('comptaPaiementsAVerifier')} ›
                  </button>
                  <div>
                    <SectionLabel>{t('rechargeTitle')}</SectionLabel>
                    <div className="flex flex-col gap-2">
                      {recharges.map((rc, i) => (
                        <div key={i} className="rounded-md border border-de9-line px-[13px] py-[11px]">
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
                                <Glyph icon={ReceiptText} /> {t('justifCourt')}
                              </button>
                            )}
                            {rc.facture && (
                              <button
                                type="button"
                                onClick={() => openPiece(rc.factTitle, rc.factName)}
                                className="cursor-pointer rounded-full bg-[#E7F6EE] px-[9px] py-1 text-[10px] font-bold text-de9-teal-dark dark:bg-[#2FA86A]/15"
                              >
                                <Glyph icon={ReceiptText} /> {t('factureCourt')}
                              </button>
                            )}
                            {rc.refBadge && (
                              <span className="rounded-full bg-[#FBF4E4] px-[9px] py-1 text-[10px] font-bold text-[#B68A2E] dark:bg-[#B68A2E]/15 dark:text-[#D9B36A]">
                                <Glyph icon={TriangleAlert} /> {rc.refBadge}
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
                          className="flex items-center justify-between gap-2 rounded-sm bg-secondary px-3 py-[9px]"
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
                    <label className="cursor-pointer rounded-sm bg-[#E5F7F4] px-3 py-[7px] text-[11.5px] font-bold text-de9-teal-dark dark:bg-[#2AB3A8]/15">
                      <Glyph icon={Plus} /> {t('ajouterDocClient')}
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
                      className="flex items-center gap-2.5 rounded-md border border-de9-line px-[13px] py-[11px]"
                    >
                      <span className="flex-none text-[17px]"><Glyph icon={FileText} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] font-bold text-de9-ink">{dl.title}</div>
                        <div className="truncate text-[10.5px] text-de9-gray">{dl.file}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openPiece(dl.title, dl.file)}
                        className="flex-none cursor-pointer rounded-full bg-primary px-[11px] py-[7px] text-[11px] font-bold text-primary-foreground"
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
              className="w-full cursor-pointer rounded-full bg-secondary py-[13px] text-center text-[13.5px] font-bold text-de9-slate"
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
