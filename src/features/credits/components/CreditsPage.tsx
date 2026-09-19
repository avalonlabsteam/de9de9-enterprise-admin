// CRÉDITS — ledger on the /credits API family:
//   list      GET  /credits
//   cards     GET  /credits/kpis?period=mois|annee|perso
//   tabs      GET  /credits/filtres            (counts, sorts, the Client list)
//   detail    GET  /credits/{movementId}       (clicking a row)
//   export    GET  /credits/export             (the CSV for the filters on screen)
//   recharge  POST /credits/recharges · pièces POST …/{rechargeId}/pieces — RechargeModal
// A débit or versement opens its facture in the Factures screen by invoiceId.
import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent, ReactElement, ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useT, useL, type TKey } from '@/lib/i18n';
import { useLangStore, type Lang } from '@/stores/langStore';
import { cn } from '@/lib/utils';
import { problemMessage } from '@/api/problem';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { CreditLedgerItem, CreditsLedgerParams, CreditsPeriod, CreditType, PieceFile } from '../schemas/credit';
import { exportCreditsCsv, useCreditMovement, useCreditsFiltres, useCreditsKpis, useCreditsLedger } from '../api/credits';
import { RechargeModal, type RechargeModalState } from './RechargeModal';
import { PieceViewer, type PieceView } from './PieceViewer';

/* ---- dates: re-derived from ISO so the day name follows the UI language (the
   server's `date` string is pre-formatted in French) ---- */
const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const pad = (n: number): string => String(n).padStart(2, '0');

function dateLabel(iso: string, lang: Lang): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  const day = (lang === 'ar' ? DAYS_AR : DAYS_FR)[dt.getDay()];
  return `${day} ${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`;
}

function shortDate(iso: string): string {
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? iso : `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`;
}

const fmt = (n: number): string => n.toLocaleString('fr-FR');

// Algeria is UTC+1 all year. A bare `au` date means midnight and would drop the
// whole last day, so the bounds are sent as full Algiers timestamps.
const ALGIERS = '+01:00';

type CreditFilter = 'all' | CreditType;

const TYPE_BADGE: Record<CreditType, { labelKey: TKey; cls: string }> = {
  rech: { labelKey: 'creditsRecharge', cls: 'bg-[#E7F6EE] text-[#2FA86A]' },
  deb: { labelKey: 'creditsDebitFacture', cls: 'bg-[#FDECEC] text-de9-red' },
  vers: { labelKey: 'creditsVersement', cls: 'bg-[#EAF2FD] text-[#2F7FD0]' },
};

const CARDS: ReadonlyArray<{ key: 'vendus' | 'depenses' | 'versementsPro' | 'marge'; labelKey: TKey; colorCls: string }> = [
  { key: 'vendus', labelKey: 'creditsVendus', colorCls: 'text-[#2FA86A] dark:text-[#6FCF97]' },
  { key: 'depenses', labelKey: 'creditsDepenses', colorCls: 'text-de9-red' },
  { key: 'versementsPro', labelKey: 'creditsVersementsPro', colorCls: 'text-[#2F7FD0] dark:text-[#7EB5EC]' },
  { key: 'marge', labelKey: 'creditsMarge', colorCls: 'text-de9-ink' },
];

const PERIODS: ReadonlyArray<{ key: CreditsPeriod; labelKey: TKey }> = [
  { key: 'mois', labelKey: 'creditsPeriodeMois' },
  { key: 'annee', labelKey: 'creditsPeriodeAnnee' },
  { key: 'perso', labelKey: 'creditsPeriodePerso' },
];

const FILTERS: ReadonlyArray<{ key: CreditFilter; labelKey: TKey }> = [
  { key: 'all', labelKey: 'tous' },
  { key: 'rech', labelKey: 'creditsRecharges' },
  { key: 'deb', labelKey: 'creditsDebits' },
  { key: 'vers', labelKey: 'creditsVersements' },
];

const GRID_COLS = 'grid-cols-[1fr_1.2fr_1.8fr_1.4fr_1fr_1.1fr_1fr]';
const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;
const SELECT_CLS =
  'rounded-[11px] border-[1.5px] border-de9-line bg-card px-3 py-2.5 text-[12.5px] font-semibold text-de9-slate outline-none';
const LINK_CLS = 'cursor-pointer underline decoration-[#C7CFD7] decoration-dotted underline-offset-[3px]';

/** Inner clickables must not also open the row's detail. */
const stop =
  (fn: () => void) =>
  (ev: MouseEvent): void => {
    ev.stopPropagation();
    fn();
  };

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-de9-gray">{label}</span>
      <span className="text-end font-semibold text-de9-ink">{children}</span>
    </div>
  );
}

/* ---- one movement — GET /credits/{movementId} ---- */
function MovementDialog({
  id,
  onClose,
  onOpenFacture,
  onOpenPiece,
}: {
  id: string;
  onClose: () => void;
  onOpenFacture: (invoiceId: string) => void;
  onOpenPiece: (piece: PieceView) => void;
}) {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const q = useCreditMovement(id);
  const m = q.data;
  const recharge = m?.recharge;
  const debit = m?.debit;
  const factureId = debit?.factureId;

  const piece = (title: string, fileName: string | null | undefined, documentId: string | null | undefined) =>
    fileName ? (
      <button
        type="button"
        onClick={() => onOpenPiece({ title, fileName, documentId })}
        className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[#BFE6D6] bg-[#E7F6EE] px-2.5 py-1 text-[11px] font-bold text-de9-teal-dark dark:border-[#2FA86A]/40 dark:bg-[#2FA86A]/15"
      >
        🧾 {title}
      </button>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#F0E2C0] bg-[#FBF4E4] px-2.5 py-1 text-[11px] font-bold text-[#B68A2E] dark:border-[#B68A2E]/40 dark:bg-[#B68A2E]/15 dark:text-[#D9B36A]">
        ⚠ {title} · {t('manquant')}
      </span>
    );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="block max-h-[90vh] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-[22px] bg-card p-7 sm:max-w-[480px]"
      >
        <DialogTitle className="text-[19px] leading-normal font-extrabold text-de9-ink">
          {t('creditsDetailTitle')}
        </DialogTitle>
        {q.isPending && <div className="mt-4 h-40 animate-pulse rounded-[14px] bg-secondary" />}
        {q.isError && (
          <div className="mt-4 rounded-xl border border-[#F3C9CB] bg-[#FDECEC] px-4 py-3 text-[12.5px] font-semibold text-de9-red dark:border-[#E7464E]/40 dark:bg-[#E7464E]/15">
            {problemMessage(q.error)}
          </div>
        )}
        {m && (
          <div className="mt-3.5 flex flex-col gap-2.5 text-[13px]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-de9-ink">
                {m.typeLabel ?? m.type} · {m.reference ?? '—'}
              </span>
              <span className="text-xs text-de9-gray">
                {m.occurredAt ? dateLabel(m.occurredAt, lang) : (m.date ?? '')}
              </span>
            </div>
            <div
              className={cn(
                'text-[22px] font-extrabold',
                m.credits > 0 ? 'text-[#2FA86A] dark:text-[#6FCF97]' : 'text-de9-red',
              )}
            >
              {(m.credits > 0 ? '+' : '') + fmt(m.credits)} cr
              {m.dzd != null && <span className="ms-2 text-[12px] font-semibold text-de9-gray">≈ {fmt(m.dzd)} DZD</span>}
            </div>
            {(m.soldeAvant || m.soldeApres) && (
              <div className="rounded-[10px] bg-secondary px-3.5 py-2.5 text-[12px] text-de9-slate">
                {t('creditsSoldeAvant')} <b>{m.soldeAvant ?? '—'}</b> → {t('creditsSoldeApres')}{' '}
                <b>{m.soldeApres ?? '—'}</b>
              </div>
            )}
            {m.client && <Line label={t('lgClient')}>{m.client}</Line>}
            {m.note && <Line label={t('creditsNote')}>{m.note}</Line>}

            {recharge && (
              <>
                {recharge.methode && <Line label={t('rMethode')}>{recharge.methode}</Line>}
                <div className="flex flex-wrap gap-2">
                  {piece(
                    t('pieceJustif'),
                    recharge.justificatifFileName,
                    recharge.justificatifDocumentId ?? recharge.justificatifUrl,
                  )}
                  {piece(t('pieceFacture'), recharge.factureFileName, recharge.factureDocumentId ?? recharge.factureUrl)}
                </div>
              </>
            )}

            {debit && (
              <>
                {debit.prestataire && <Line label={t('pro')}>{debit.prestataire}</Line>}
                {debit.service && <Line label={t('bService')}>{debit.service}</Line>}
                {debit.visiteLe && <Line label={t('creditsVisiteLe')}>{dateLabel(debit.visiteLe, lang)}</Line>}
                {debit.montantFactureCredits != null &&
                  debit.ventilationPrestataireCredits != null &&
                  debit.ventilationMargeCredits != null && (
                    <div className="rounded-[10px] bg-secondary px-3.5 py-2.5 text-[12px] text-de9-slate">
                      {t('ventilation')} : <b>{fmt(debit.montantFactureCredits)}</b> →{' '}
                      <b className="text-[#2FA86A] dark:text-[#6FCF97]">{fmt(debit.ventilationPrestataireCredits)}</b>{' '}
                      {t('pro')} · <b className="text-de9-red">{fmt(debit.ventilationMargeCredits)}</b> de9de9
                    </div>
                  )}
                {factureId && (
                  <button
                    type="button"
                    onClick={() => onOpenFacture(factureId)}
                    className="cursor-pointer self-start text-[12px] font-bold text-[#2F7FD0] dark:text-[#7EB5EC]"
                  >
                    🧾 {t('voirFacture')} {debit.factureRef ?? ''} →
                  </button>
                )}
              </>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full cursor-pointer rounded-[13px] bg-[#232838] p-3.5 text-center text-sm font-bold text-white"
        >
          {t('btnClose')}
        </button>
      </DialogContent>
    </Dialog>
  );
}

/** Ledger page — historique des crédits (recharges, débits facture, versements pro). */
export function CreditsPage() {
  const t = useT();
  const l = useL();
  const lang = useLangStore((s) => s.lang);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filter, setFilter] = useState<CreditFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState<CreditsPeriod>('mois');
  const [du, setDu] = useState('');
  const [au, setAu] = useState('');
  const [clientId, setClientId] = useState('');
  const [tri, setTri] = useState('');
  const [modal, setModal] = useState<RechargeModalState | null>(null);
  const [piece, setPiece] = useState<PieceView | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      setQ(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput]);

  // A custom period bounds both the cards and the ledger; mois / annee bound
  // only the cards, and the ledger stays the whole history.
  const customReady = period === 'perso' && !!du && !!au;
  const rangeDu = customReady ? du + 'T00:00:00' + ALGIERS : undefined;
  const rangeAu = customReady ? au + 'T23:59:59' + ALGIERS : undefined;

  const params = useMemo<CreditsLedgerParams>(() => {
    const p: CreditsLedgerParams = { page, pageSize: PAGE_SIZE };
    if (q) p.q = q;
    if (filter !== 'all') p.type = filter;
    if (clientId) p.clientId = clientId;
    if (tri) p.tri = tri;
    if (rangeDu && rangeAu) {
      p.du = rangeDu;
      p.au = rangeAu;
    }
    return p;
  }, [q, filter, page, clientId, tri, rangeDu, rangeAu]);

  const ledgerQ = useCreditsLedger(params);
  const kpisQ = useCreditsKpis({ period, du: rangeDu, au: rangeAu });
  const filtresQ = useCreditsFiltres(params);
  const rows = ledgerQ.data?.data ?? [];
  const meta = ledgerQ.data?.meta;
  // A half-filled custom range has no numbers yet — don't show the last period's.
  const kpis = period === 'perso' && !customReady ? undefined : kpisQ.data;
  const filtres = filtresQ.data;
  const countOf = (code: CreditFilter): number | undefined => filtres?.types.find((x) => x.code === code)?.count;

  const setFilterKey = (key: CreditFilter): void => {
    setFilter(key);
    setPage(1);
  };

  const periodSub =
    period === 'mois'
      ? t('creditsPeriodeMois')
      : period === 'annee'
        ? t('creditsPeriodeAnnee')
        : kpis
          ? t('creditsDuAu').replace('{d}', shortDate(kpis.periodeDebut)).replace('{a}', shortDate(kpis.periodeFin))
          : t('creditsPeriodePerso');

  const onExport = (): void => {
    setExporting(true);
    exportCreditsCsv(params, t('creditsExportErreur'))
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : t('creditsExportErreur')))
      .finally(() => setExporting(false));
  };

  // ---- overlays (client fiche by name; prestataire profile keyed by company id) ----
  const openClientFiche = (name: string): void => {
    if (!name || name === 'de9de9' || name === '—') return;
    const sp = new URLSearchParams(searchParams);
    sp.set('client', name);
    sp.delete('pres');
    setSearchParams(sp);
  };
  const openPres = (id: string | null | undefined, name: string | null | undefined): void => {
    const key = id || name;
    if (!key || key === '—') return;
    const sp = new URLSearchParams(searchParams);
    sp.set('pres', key);
    sp.delete('client');
    setSearchParams(sp);
  };
  const openFacture = (invoiceId: string): void => {
    navigate('/factures?invoice=' + encodeURIComponent(invoiceId));
  };

  /* ---- pieces chip (🧾 present / ⚠ manquant) ---- */
  const pieceChip = (
    e: CreditLedgerItem,
    file: PieceFile | null | undefined,
    kindLabel: string,
    title: string,
  ): ReactElement => {
    const present = !!file;
    return (
      <button
        type="button"
        onClick={stop(() => {
          if (present && file) setPiece({ title, fileName: file.name, documentId: file.id ?? file.url });
          else
            setModal({
              mode: 'docs',
              rechargeId: e.rechargeId ?? null,
              ref: e.ref,
              client: e.client,
              justif: e.justif ?? null,
              facture: e.facture ?? null,
            });
        })}
        className={cn(
          'inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold',
          present
            ? 'border-[#BFE6D6] bg-[#E7F6EE] text-de9-teal-dark dark:border-[#2FA86A]/40 dark:bg-[#2FA86A]/15'
            : 'border-[#F0E2C0] bg-[#FBF4E4] text-[#B68A2E] dark:border-[#B68A2E]/40 dark:bg-[#B68A2E]/15 dark:text-[#D9B36A]',
        )}
      >
        {present ? '🧾' : '⚠'} {present ? `${kindLabel} ✓` : `${kindLabel} · ${t('manquant')}`}
      </button>
    );
  };

  return (
    <div>
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="text-[23px] font-extrabold">{t('historiqueCredits')}</div>
          <div className="mt-[2px] text-[13.5px] text-de9-gray">{t('creditsSub')}</div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => setModal({ mode: 'create' })}
            className="cursor-pointer rounded-[11px] bg-de9-teal-dark px-[18px] py-[11px] text-[12.5px] font-bold text-white shadow-[0_8px_18px_rgba(23,138,130,.32)]"
          >
            ＋ {t('nouvelleRecharge')}
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            className="cursor-pointer rounded-[11px] border-[1.5px] border-de9-line bg-card px-4 py-[11px] text-[12.5px] font-bold text-de9-slate disabled:opacity-60"
          >
            ⤓ {exporting ? t('docTelechargementEnCours') : t('exportCsv')}
          </button>
        </div>
      </div>

      {/* period — drives the cards (and, when custom, the ledger range) */}
      <div className="mt-4 flex flex-wrap items-center gap-[9px]">
        {PERIODS.map((pp) => (
          <button
            key={pp.key}
            type="button"
            onClick={() => {
              setPeriod(pp.key);
              setPage(1);
            }}
            className={cn(
              'cursor-pointer rounded-full border-[1.5px] px-[13px] py-[7px] text-[12px] font-bold',
              period === pp.key ? 'border-[#232838] bg-[#232838] text-white' : 'border-de9-line bg-card text-de9-slate',
            )}
          >
            {t(pp.labelKey)}
          </button>
        ))}
        {period === 'perso' && (
          <>
            <label className="flex items-center gap-1.5 text-[12px] font-semibold text-de9-gray">
              {t('fcDu')}
              <input
                type="date"
                value={du}
                max={au || undefined}
                onChange={(e) => {
                  setDu(e.target.value);
                  setPage(1);
                }}
                className={SELECT_CLS}
              />
            </label>
            <label className="flex items-center gap-1.5 text-[12px] font-semibold text-de9-gray">
              {t('fcAu')}
              <input
                type="date"
                value={au}
                min={du || undefined}
                onChange={(e) => {
                  setAu(e.target.value);
                  setPage(1);
                }}
                className={SELECT_CLS}
              />
            </label>
            {!customReady && (
              <span className="text-[11.5px] font-semibold text-de9-gray">{t('creditsPersoIncomplet')}</span>
            )}
          </>
        )}
        {kpisQ.data?.enCirculation && (
          <span className="ms-auto text-[12px] font-semibold text-de9-gray">
            {t('creditsEnCirculation')} : <b className="text-de9-ink">{kpisQ.data.enCirculation.formatted}</b> cr
          </span>
        )}
      </div>

      {ledgerQ.isPending ? (
        <div className="mt-4 animate-pulse">
          <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[104px] rounded-2xl border border-de9-line bg-card" />
            ))}
          </div>
          <div className="mt-3.5 h-64 rounded-[18px] border border-de9-line bg-card" />
        </div>
      ) : ledgerQ.isError ? (
        <div className="mt-4 rounded-xl border border-[#F3C9CB] bg-[#FDECEC] px-4 py-3 text-[12.5px] font-semibold text-de9-red dark:border-[#E7464E]/40 dark:bg-[#E7464E]/15">
          {l('Erreur de chargement des crédits', 'خطأ في تحميل الرصيد')} — {problemMessage(ledgerQ.error)}
        </div>
      ) : (
        <>
          {/* cards — GET /credits/kpis */}
          <div className="mt-3.5 grid grid-cols-2 gap-3.5 md:grid-cols-4">
            {CARDS.map((c) => {
              const bucket = kpis?.[c.key];
              return (
                <div
                  key={c.key}
                  className="rounded-2xl border border-de9-line bg-card px-[18px] py-4 shadow-[0_6px_18px_rgba(38,50,69,.04)]"
                >
                  <div className="text-xs font-semibold text-de9-gray">{t(c.labelKey)}</div>
                  <div className={cn('mt-1.5 text-[23px] font-extrabold', c.colorCls)}>{bucket?.formatted ?? '—'}</div>
                  <div className="text-[11px] text-de9-gray">
                    {periodSub}
                    {bucket ? ' · ' + t('creditsMouvements').replace('{n}', String(bucket.mouvements)) : ''}
                  </div>
                </div>
              );
            })}
          </div>

          {/* search + tabs (counts from /filtres) */}
          <div className="mt-4 flex flex-wrap items-center gap-[9px]">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('facSearch')}
              className="min-w-0 flex-1 rounded-[11px] border-[1.5px] border-de9-line bg-card px-[15px] py-2.5 text-[12.5px] text-de9-ink outline-none sm:flex-[0_0_300px]"
            />
            {FILTERS.map((f) => {
              const active = filter === f.key;
              const n = countOf(f.key);
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilterKey(f.key)}
                  className={cn(
                    'cursor-pointer rounded-full border-[1.5px] px-[15px] py-[9px] text-[12.5px] font-bold',
                    active ? 'border-[#232838] bg-[#232838] text-white' : 'border-de9-line bg-card text-de9-slate',
                  )}
                >
                  {t(f.labelKey)}
                  {n != null ? ` · ${n}` : ''}
                </button>
              );
            })}
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-[9px]">
            <select
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setPage(1);
              }}
              className={SELECT_CLS}
            >
              <option value="">
                {t('fClient')} : {t('tous')}
              </option>
              {(filtres?.clients.items ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nom}
                </option>
              ))}
            </select>
            <select
              value={tri}
              onChange={(e) => {
                setTri(e.target.value);
                setPage(1);
              }}
              className={SELECT_CLS}
            >
              <option value="">{t('fcTri')}</option>
              {(filtres?.tris ?? []).map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
            {filtres?.clients.truncated && (
              <span className="text-[11px] font-semibold text-de9-gray">{t('worklistFiltresTronques')}</span>
            )}
          </div>

          {/* ledger */}
          <div className="mt-3.5 overflow-hidden rounded-[18px] border border-de9-line bg-card shadow-[0_10px_30px_rgba(38,50,69,.06)]">
            <div className={cn('overflow-x-auto transition-opacity', ledgerQ.isPlaceholderData && 'opacity-60')}>
              <div className="min-w-[840px]">
                <div
                  className={cn(
                    'grid gap-3 border-b border-de9-line bg-secondary px-[22px] py-[13px] text-[10.5px] font-bold tracking-[.04em] text-de9-gray uppercase',
                    GRID_COLS,
                  )}
                >
                  <div>{t('lgDate')}</div>
                  <div>{t('lgType')}</div>
                  <div>{t('lgClient')}</div>
                  <div>{t('lgBenef')}</div>
                  <div>{t('lgRef')}</div>
                  <div className="text-end">{t('lgCredits')}</div>
                  <div className="text-end">{t('lgSolde')}</div>
                </div>
                {rows.map((e) => {
                  const badge = TYPE_BADGE[e.type];
                  const benef = e.benef ?? '—';
                  const isRech = e.type === 'rech';
                  return (
                    <div
                      key={e.id}
                      onClick={() => setDetailId(e.id)}
                      className={cn(
                        'grid cursor-pointer items-center gap-3 border-b border-de9-line px-[22px] py-3.5 hover:bg-secondary/60',
                        GRID_COLS,
                      )}
                    >
                      <div className="text-[12.5px] text-de9-slate">{dateLabel(e.occurredAt, lang)}</div>
                      <div>
                        <span className={cn('rounded-full px-[9px] py-1 text-[11px] font-bold', badge.cls)}>
                          {t(badge.labelKey)}
                        </span>
                      </div>
                      <div className="text-[13px] font-semibold">
                        {e.client === 'de9de9' ? (
                          e.client
                        ) : (
                          <span onClick={stop(() => openClientFiche(e.client))} className={LINK_CLS}>
                            {e.client}
                          </span>
                        )}
                      </div>
                      <div className="text-[12.5px] text-de9-slate">
                        {benef === '—' ? (
                          benef
                        ) : (
                          <span onClick={stop(() => openPres(e.beneficiaireId, benef))} className={LINK_CLS}>
                            {benef}
                          </span>
                        )}
                      </div>
                      <div className="text-[11.5px] text-de9-gray">
                        {e.ref}
                        {!isRech && e.invoiceId && (
                          <span
                            onClick={stop(() => openFacture(e.invoiceId ?? ''))}
                            className="mt-[2px] block cursor-pointer text-[10.5px] font-bold text-[#2F7FD0] dark:text-[#7EB5EC]"
                          >
                            🧾 {e.type === 'vers' ? t('voirFacturePresta') : t('voirFacture')} →
                          </span>
                        )}
                        {isRech && (
                          <div className="mt-1.5 flex flex-wrap gap-[5px]">
                            {pieceChip(e, e.justif, t('justifCourt'), t('pieceJustif'))}
                            {pieceChip(e, e.facture, t('factureCourt'), t('pieceFacture'))}
                          </div>
                        )}
                      </div>
                      <div
                        className={cn(
                          'text-end text-[13.5px] font-extrabold',
                          e.credits > 0 ? 'text-[#2FA86A] dark:text-[#6FCF97]' : 'text-de9-red',
                        )}
                      >
                        {(e.credits > 0 ? '+' : '') + fmt(e.credits)}
                      </div>
                      <div className="text-end text-[12.5px] text-de9-slate">{e.solde ?? '—'}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            {rows.length === 0 && (
              <div className="px-[22px] py-8 text-center text-[12.5px] text-de9-gray">{t('aucuneDonnee')}</div>
            )}

            {meta && meta.total_pages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-de9-line px-[22px] py-3">
                <div className="text-[12.5px] font-semibold text-de9-gray">
                  {t('worklistPageInfo')
                    .replace('{n}', String(meta.current_page))
                    .replace('{m}', String(meta.total_pages))}
                  {' · '}
                  {meta.total} {t('operationsCount')}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((n) => Math.max(1, n - 1))}
                    className="cursor-pointer rounded-[11px] border-[1.5px] border-de9-line bg-card px-[13px] py-2 text-[12.5px] font-bold text-de9-slate disabled:cursor-default disabled:opacity-40"
                  >
                    {t('pagePrecedent')}
                  </button>
                  <button
                    type="button"
                    disabled={!meta.has_more_pages}
                    onClick={() => setPage((n) => n + 1)}
                    className="cursor-pointer rounded-[11px] border-[1.5px] border-de9-line bg-card px-[13px] py-2 text-[12.5px] font-bold text-de9-slate disabled:cursor-default disabled:opacity-40"
                  >
                    {t('pageSuivant')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {modal && (
        <RechargeModal
          state={modal}
          onClose={() => setModal(null)}
          onDone={() => {
            const created = modal.mode === 'create';
            setModal(null);
            if (created) setFilterKey('all');
          }}
        />
      )}
      {detailId && (
        <MovementDialog
          id={detailId}
          onClose={() => setDetailId(null)}
          onOpenFacture={(invoiceId) => {
            setDetailId(null);
            openFacture(invoiceId);
          }}
          onOpenPiece={(p) => {
            // One dialog at a time: close the detail before the viewer opens.
            setDetailId(null);
            setPiece(p);
          }}
        />
      )}
      {piece && <PieceViewer piece={piece} onClose={() => setPiece(null)} />}
    </div>
  );
}
