import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useT, useL, type TKey } from '@/lib/i18n';
import { useLangStore, type Lang } from '@/stores/langStore';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useFactures, useFactureAction, type FactureActionKind } from '../api/factures';
import type { Facture, FactureStatus } from '../schemas/facture';

// ===================== derivation (ported from logic.ts buildFactures) =====================

type FilterKey = 'all' | 'attente' | 'litige' | 'regler' | 'paid';
type Group = Exclude<FilterKey, 'all'>;

interface ActionMeta {
  kind: FactureActionKind;
  labelKey: TKey;
  cls: string; // bg / fg / border — prototype ST actions [kind, label, bg, fg, border?]
}

interface StatusMeta {
  labelKey: TKey;
  num: string; // cosmetic S/V chip (logic.ts statusNum)
  group: Group;
  pill: string; // pill bg + fg
  dot: string; // pill dot bg
  actions: ActionMeta[];
  badgeLabelKey: TKey; // occProj badge used in the "view facture" modal
  badgeCls: string;
}

const STATUS_META: Record<FactureStatus, StatusMeta> = {
  doneInvoiced: {
    labelKey: 'fcReçue',
    num: 'V5',
    group: 'attente',
    pill: 'bg-[#FEF6E9] text-[#C98A1E]',
    dot: 'bg-[#E6A53A]',
    actions: [
      { kind: 'approve', labelKey: 'fcApprouver', cls: 'border-[#2E9E5B] bg-[#2E9E5B] text-white' },
      {
        kind: 'contest',
        labelKey: 'fcContester',
        cls: 'border-[#F3C9CB] bg-white text-de9-red dark:border-[#E7464E]/40 dark:bg-[#E7464E]/15',
      },
    ],
    badgeLabelKey: 'consoleBadgeFactureDeposee',
    badgeCls: 'bg-[#F4EFFB] text-[#7C57C7]',
  },
  doneDisputed: {
    labelKey: 'fcContestee',
    num: 'V5·C',
    group: 'litige',
    pill: 'bg-[#FDECEC] text-de9-red',
    dot: 'bg-de9-red',
    actions: [{ kind: 'resolve', labelKey: 'fcResoudre', cls: 'border-[#232838] bg-[#232838] text-white' }],
    badgeLabelKey: 'consoleBadgeContestee',
    badgeCls: 'bg-[#FDECEC] text-de9-red',
  },
  doneApproved: {
    labelKey: 'fcApprouvee',
    num: 'V6',
    group: 'regler',
    pill: 'bg-[#E6F6EC] text-[#2E9E5B]',
    dot: 'bg-[#2E9E5B]',
    actions: [{ kind: 'settle', labelKey: 'fcRegler', cls: 'border-[#2E9E5B] bg-[#2E9E5B] text-white' }],
    badgeLabelKey: 'consoleBadgeApprouvee',
    badgeCls: 'bg-[#E7F6EE] text-[#2FA86A]',
  },
  paid: {
    labelKey: 'fcPayee',
    num: 'V7',
    group: 'paid',
    pill: 'bg-[#EEF1F4] text-[#6B7280]',
    dot: 'bg-[#9AA4B2]',
    actions: [],
    badgeLabelKey: 'consoleBadgePayee',
    badgeCls: 'bg-[#E7F6EE] text-[#2FA86A]',
  },
};

const TOTALS: { group: Group; labelKey: TKey; colorCls: string }[] = [
  { group: 'attente', labelKey: 'fcTotalAttente', colorCls: 'text-[#C98A1E] dark:text-[#D9B36A]' },
  { group: 'regler', labelKey: 'fcTotalRegler', colorCls: 'text-[#2E9E5B] dark:text-[#6FCF97]' },
  { group: 'litige', labelKey: 'fcLitige', colorCls: 'text-de9-red' },
  { group: 'paid', labelKey: 'fcTotalPaid', colorCls: 'text-de9-ink' },
];

const FILTERS: { key: FilterKey; labelKey: TKey }[] = [
  { key: 'all', labelKey: 'fcAll' },
  { key: 'attente', labelKey: 'fcAttente' },
  { key: 'litige', labelKey: 'fcLitige' },
  { key: 'regler', labelKey: 'fcARegler' },
  { key: 'paid', labelKey: 'fcPaid' },
];

const TOAST_KEY: Record<FactureActionKind, TKey> = {
  approve: 'consoleToastFactureApprouvee',
  contest: 'consoleToastFactureContestee',
  resolve: 'consoleToastLitigeResolu',
  settle: 'consolePayeTransfere',
};

const fmt = (n: number): string => n.toLocaleString('fr-FR');

/** 'dd/mm/yyyy' → sortable number (logic.ts toNum). */
const toNum = (d: string): number => {
  const p = d.split('/');
  return p.length === 3 ? Number(p[2]) * 10000 + Number(p[1]) * 100 + Number(p[0]) : 0;
};

/** Prefix the localized weekday name (logic.ts dayName/withDay). */
function withDay(s: string, lang: Lang): string {
  const m = s.match(/(\d{2}\/\d{2}\/\d{4})/);
  if (!m || !m[1]) return s;
  const p = m[1].split('/');
  const dt = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
  if (Number.isNaN(dt.getTime())) return s;
  const fr = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const ar = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const day = (lang === 'ar' ? ar : fr)[dt.getDay()];
  return day ? s.replace(m[1], day + ' ' + m[1]) : s;
}

// ===================== page =====================

export function FacturesPage() {
  const t = useT();
  const l = useL();
  const lang = useLangStore((s) => s.lang);
  const [searchParams] = useSearchParams();

  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState(() => searchParams.get('client') ?? '');
  const [approveTarget, setApproveTarget] = useState<Facture | null>(null);
  const [viewTarget, setViewTarget] = useState<Facture | null>(null);

  const { data, isPending, isError } = useFactures();
  const action = useFactureAction();

  // newest first by visit date
  const all = [...(data ?? [])].sort((a, b) => toNum(b.date) - toNum(a.date));

  const q = search.trim().toLowerCase();
  let view = all;
  if (q) {
    const qc = q.replace(/\s/g, '');
    view = view.filter(
      (f) =>
        f.client.toLowerCase().includes(q) ||
        f.email.toLowerCase().includes(q) ||
        f.contact.toLowerCase().replace(/\s/g, '').includes(qc),
    );
  }
  if (filter !== 'all') view = view.filter((f) => STATUS_META[f.status].group === filter);

  const countBy = (g: Group): number => all.filter((f) => STATUS_META[f.status].group === g).length;
  const sumBy = (g: Group): number =>
    all.filter((f) => STATUS_META[f.status].group === g).reduce((s, f) => s + f.montant, 0);
  const counts: Record<FilterKey, number> = {
    all: all.length,
    attente: countBy('attente'),
    litige: countBy('litige'),
    regler: countBy('regler'),
    paid: countBy('paid'),
  };

  const runAction = (f: Facture, kind: FactureActionKind, onDone?: () => void) => {
    action.mutate(
      { cmdId: f.cmdId, kind, occId: f.occId },
      {
        onSuccess: () => {
          toast.success(t(TOAST_KEY[kind]));
          onDone?.();
        },
      },
    );
  };

  const onRowAction = (f: Facture, kind: FactureActionKind) => {
    if (kind === 'approve') setApproveTarget(f);
    else runAction(f, kind);
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="text-[23px] font-extrabold">{t('facturesTitle')}</div>
          <div className="mt-[2px] text-[13.5px] text-de9-gray">{t('facturesSub')}</div>
        </div>
      </div>

      {isPending ? (
        <div className="mt-4 animate-pulse">
          <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[104px] rounded-2xl border border-de9-line bg-card" />
            ))}
          </div>
          <div className="mt-3.5 h-64 rounded-[18px] border border-de9-line bg-card" />
        </div>
      ) : isError ? (
        <div className="mt-4 rounded-xl border border-[#F3C9CB] bg-[#FDECEC] px-4 py-3 text-[12.5px] font-semibold text-de9-red dark:border-[#E7464E]/40 dark:bg-[#E7464E]/15">
          {l('Erreur de chargement des factures', 'خطأ في تحميل الفواتير')}
        </div>
      ) : (
        <>
          {/* totals */}
          <div className="mt-4 grid grid-cols-2 gap-3.5 md:grid-cols-4">
            {TOTALS.map((tot) => (
              <div
                key={tot.group}
                className="rounded-2xl border border-de9-line bg-card px-[18px] py-4 shadow-[0_6px_18px_rgba(38,50,69,.04)]"
              >
                <div className="text-xs font-semibold text-de9-gray">{t(tot.labelKey)}</div>
                <div className={cn('mt-1.5 text-[22px] font-extrabold', tot.colorCls)}>
                  {fmt(sumBy(tot.group))}{' '}
                  <span className="text-xs font-semibold text-de9-gray">{t('credits')}</span>
                </div>
                <div className="text-[11px] text-de9-gray">
                  {counts[tot.group]} {t('fcCount')}
                </div>
              </div>
            ))}
          </div>

          {/* search + filters */}
          <div className="mt-4 flex flex-wrap items-center gap-[9px]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('facSearch')}
              className="min-w-0 flex-1 rounded-[11px] border-[1.5px] border-de9-line bg-card px-[15px] py-2.5 text-[12.5px] text-de9-ink outline-none sm:flex-[0_0_300px]"
            />
            {FILTERS.map((ff) => {
              const active = filter === ff.key;
              return (
                <button
                  key={ff.key}
                  type="button"
                  onClick={() => setFilter(ff.key)}
                  className={cn(
                    'cursor-pointer rounded-full border-[1.5px] px-[15px] py-[9px] text-[12.5px] font-bold',
                    active ? 'border-[#232838] bg-[#232838] text-white' : 'border-de9-line bg-card text-de9-slate',
                  )}
                >
                  {t(ff.labelKey)} · {counts[ff.key]}
                </button>
              );
            })}
          </div>

          {/* table */}
          <div className="mt-3.5 overflow-hidden rounded-[18px] border border-de9-line bg-card shadow-[0_10px_30px_rgba(38,50,69,.06)]">
            <div className="overflow-x-auto">
              <div className="min-w-[880px]">
                <div className="grid grid-cols-[1.3fr_1.7fr_1.3fr_1.3fr_1fr_1.2fr_1.8fr] gap-3 border-b border-de9-line bg-secondary px-[22px] py-[13px] text-[10.5px] font-bold tracking-[.04em] text-de9-gray uppercase">
                  <div>{t('fcRef')}</div>
                  <div>{t('fcEnt')}</div>
                  <div>{t('fcPro')}</div>
                  <div>{t('fcDate')}</div>
                  <div className="text-end">{t('fcMontant')}</div>
                  <div>{t('fcStatut')}</div>
                  <div className="text-end">{t('fcActions')}</div>
                </div>

                {view.map((f) => {
                  const st = STATUS_META[f.status];
                  return (
                    <div
                      key={f.cmdId + '-' + f.occId}
                      className="grid grid-cols-[1.3fr_1.7fr_1.3fr_1.3fr_1fr_1.2fr_1.8fr] items-center gap-3 border-b border-de9-line px-[22px] py-3.5"
                    >
                      <div>
                        <div className="text-[13px] font-extrabold">{f.ref}</div>
                        <div className="text-[11px] text-de9-gray">
                          {f.cmdId} · {f.service}
                        </div>
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold">
                          <span className="cursor-pointer underline decoration-[#C7CFD7] decoration-dotted underline-offset-[3px]">
                            {f.client}
                          </span>
                        </div>
                        <div className="text-[11px] text-de9-gray">{f.email}</div>
                      </div>
                      <div className="text-[12.5px] font-semibold text-de9-slate">
                        <span className="cursor-pointer underline decoration-[#C7CFD7] decoration-dotted underline-offset-[3px]">
                          {f.pres}
                        </span>
                      </div>
                      <div className="text-xs text-de9-slate">{withDay(f.date, lang)}</div>
                      <div className="text-end">
                        <span className="text-[13.5px] font-extrabold text-de9-ink">{fmt(f.montant)}</span>
                        <div className="text-[10px] text-de9-gray">{t('credits')}</div>
                      </div>
                      <div>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-[5px] text-[11px] font-bold',
                            st.pill,
                          )}
                        >
                          <span className="inline-flex min-w-[18px] flex-none items-center justify-center rounded-md bg-[#232838] px-[5px] py-[2px] text-[9.5px] leading-[1.4] font-extrabold tracking-[.02em] text-white">
                            {st.num}
                          </span>
                          <span className={cn('h-[7px] w-[7px] rounded-full', st.dot)} />
                          {t(st.labelKey)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-[7px]">
                        {st.actions.map((a) => (
                          <button
                            key={a.kind}
                            type="button"
                            disabled={action.isPending}
                            onClick={() => onRowAction(f, a.kind)}
                            className={cn(
                              'cursor-pointer rounded-[10px] border-[1.5px] px-[13px] py-2 text-[11.5px] font-bold disabled:opacity-60',
                              a.cls,
                            )}
                          >
                            {t(a.labelKey)}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setViewTarget(f)}
                          className="cursor-pointer rounded-[10px] border-[1.5px] border-de9-line bg-secondary px-[13px] py-2 text-[11.5px] font-bold text-de9-slate"
                        >
                          {t('fcVoir')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {view.length === 0 && (
              <div className="p-11 text-center text-sm text-de9-gray">{t('fcEmpty')}</div>
            )}
          </div>
        </>
      )}

      {/* approve on behalf of the client — confirmation modal */}
      <Dialog
        open={approveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setApproveTarget(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="block max-h-[90vh] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-[22px] bg-card p-7 sm:max-w-[460px]"
        >
          <div className="flex h-[54px] w-[54px] items-center justify-center rounded-[15px] bg-[#EAF2FD] text-[26px] dark:bg-[#2F7FD0]/15">
            ⚖️
          </div>
          <DialogTitle className="mt-4 text-[19px] leading-normal font-extrabold text-de9-ink">
            {t('modalTitle')}
          </DialogTitle>
          <DialogDescription className="mt-[9px] text-[13.5px] leading-[1.55] text-de9-slate">
            {t('modalBody')}
          </DialogDescription>
          <div className="mt-4 rounded-xl border border-[#F0E2C0] bg-[#FBF4E4] px-[15px] py-[13px] text-[12.5px] leading-[1.5] text-[#92702A] dark:border-[#92702A]/40 dark:bg-[#92702A]/15 dark:text-[#D9B36A]">
            {t('modalWarn')}
          </div>
          <div className="mt-[22px] flex gap-[11px]">
            <button
              type="button"
              onClick={() => setApproveTarget(null)}
              className="flex-1 cursor-pointer rounded-[13px] bg-secondary p-3.5 text-center text-sm font-bold text-de9-slate"
            >
              {t('annuler')}
            </button>
            <button
              type="button"
              disabled={action.isPending}
              onClick={() => {
                if (approveTarget) runAction(approveTarget, 'approve', () => setApproveTarget(null));
              }}
              className="flex-1 cursor-pointer rounded-[13px] bg-[#2F7FD0] p-3.5 text-center text-sm font-bold text-white shadow-[0_10px_22px_rgba(47,127,208,.4)] disabled:opacity-60"
            >
              {t('confirmerAuNom')}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* view facture modal */}
      <Dialog
        open={viewTarget !== null}
        onOpenChange={(open) => {
          if (!open) setViewTarget(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          aria-describedby={undefined}
          className="block max-h-[90vh] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-[22px] bg-card p-7 sm:max-w-[460px]"
        >
          {viewTarget && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <DialogTitle className="text-[19px] leading-normal font-extrabold text-de9-ink">
                  {t('titleView')}
                </DialogTitle>
                <span className="text-xs text-de9-gray">{withDay(viewTarget.date, lang)}</span>
              </div>
              <div className="mt-3.5 overflow-hidden rounded-[14px] border-[1.5px] border-de9-line">
                <div className="border-b border-de9-line bg-secondary p-7 text-center">
                  <div className="text-[42px]">📄</div>
                  <div className="mt-2 text-[13px] font-bold text-de9-slate">
                    facture-{viewTarget.occId}.pdf
                  </div>
                  <div className="text-[11px] text-de9-gray">{t('apercu')}</div>
                </div>
                <div className="px-[18px] py-4">
                  <div className="mb-2.5 flex justify-between text-sm">
                    <span className="text-de9-gray">{t('montantLabel')}</span>
                    <b className="text-base">{fmt(viewTarget.montant)} cr</b>
                  </div>
                  <div className="rounded-[10px] bg-secondary px-[13px] py-[11px] text-xs leading-[1.6] text-de9-slate">
                    {t('ventilation')} : <b>{fmt(viewTarget.montant)}</b> {t('client')} →{' '}
                    <b className="text-[#2FA86A] dark:text-[#6FCF97]">{fmt(Math.round(viewTarget.montant * 0.85))}</b> {t('pro')}{' '}
                    (85%) · <b className="text-de9-red">{fmt(Math.round(viewTarget.montant * 0.15))}</b>{' '}
                    de9de9 (15%)
                  </div>
                  <div className="mt-[13px] flex items-center gap-2">
                    <span
                      className={cn(
                        'rounded-full px-[11px] py-[5px] text-[11px] font-bold',
                        STATUS_META[viewTarget.status].badgeCls,
                      )}
                    >
                      {t(STATUS_META[viewTarget.status].badgeLabelKey)}
                    </span>
                    {viewTarget.transfere && (
                      <span className="rounded-full bg-[#2FA86A] px-[11px] py-[5px] text-[11px] font-extrabold text-white">
                        {t('transfere')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewTarget(null)}
                className="mt-5 w-full cursor-pointer rounded-[13px] bg-[#232838] p-3.5 text-center text-sm font-bold text-white"
              >
                {t('btnClose')}
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
