// Monthly credits — sold, spent, paid out — as grouped columns on one shared
// axis. Each month is a single hit target: hover, focus or tap reads out the
// three series together, and the table view carries the same figures without
// hovering.
import { useMemo, useState } from 'react';
import { ChartColumn, Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useL, useT, type TKey } from '@/lib/i18n';
import type { ChartBar } from '../schemas/analytics';

type SeriesKey = Exclude<keyof ChartBar, 'label'>;

// Colour follows the series, never its rank: slots --chart-1..3 (index.css).
const SERIES: ReadonlyArray<{ key: SeriesKey; labelKey: TKey; fill: string }> = [
  { key: 'vendus', labelKey: 'vendus', fill: 'bg-chart-1' },
  { key: 'depenses', labelKey: 'depenses', fill: 'bg-chart-2' },
  { key: 'verses', labelKey: 'verses', fill: 'bg-chart-3' },
];

const PLOT_HEIGHT = 200;

const fmt = (n: number): string => n.toLocaleString('fr-FR');
const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

/** Axis top and ticks on round numbers: a 194 M peak gives 0 · 50 M · … · 200 M. */
function niceScale(max: number): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 1, ticks: [0] };
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * pow >= rough) ?? 10) * pow;
  const count = Math.ceil(max / step);
  return { top: count * step, ticks: Array.from({ length: count + 1 }, (_, i) => i * step) };
}

export function CreditsChart({ title, bars }: { title: string; bars: ChartBar[] }) {
  const t = useT();
  const L = useL();
  const [active, setActive] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);

  const max = useMemo(() => Math.max(0, ...bars.flatMap((b) => SERIES.map((s) => b[s.key]))), [bars]);
  const { top, ticks } = useMemo(() => niceScale(max), [max]);
  const toggleLabel = asTable
    ? L('Afficher le graphique', 'عرض الرسم البياني')
    : L('Afficher le tableau', 'عرض الجدول');

  return (
    <div role="group" aria-label={title} className="rounded-md border border-de9-line bg-card px-4 py-[22px] sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="text-[15px] font-extrabold">{title}</div>
        <div className="flex items-center gap-3">
          {!asTable && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {SERIES.map((s) => (
                <span key={s.key} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-de9-slate">
                  <span className={cn('size-2.5 rounded-[2px]', s.fill)} />
                  {t(s.labelKey)}
                </span>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setAsTable((v) => !v)}
            aria-pressed={asTable}
            aria-label={toggleLabel}
            title={toggleLabel}
            className="-me-1.5 flex size-8 flex-none cursor-pointer items-center justify-center rounded-full text-on-surface-variant"
          >
            {asTable ? <ChartColumn className="size-[18px]" /> : <Table2 className="size-[18px]" />}
          </button>
        </div>
      </div>

      {asTable ? (
        <table className="mt-4 w-full text-[12.5px]">
          <thead>
            <tr className="text-de9-gray">
              <th className="py-2 text-start font-medium">{L('Mois', 'الشهر')}</th>
              {SERIES.map((s) => (
                <th key={s.key} className="py-2 text-end font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={cn('size-2.5 rounded-[2px]', s.fill)} />
                    {t(s.labelKey)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bars.map((b, i) => (
              <tr key={i} className="border-t border-de9-line/60">
                <td className="py-2 font-medium">{b.label}</td>
                {SERIES.map((s) => (
                  <td key={s.key} className="py-2 text-end tabular-nums">
                    <span className="num">{fmt(b[s.key])}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        // The padding gives the top tick label room inside the scroll box.
        <div className="overflow-x-auto pt-5">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5" style={{ minWidth: bars.length * 44 }}>
            {/* y axis — each label centred on its gridline */}
            <div
              aria-hidden
              className="-my-1.5 flex flex-col-reverse justify-between text-end text-[11px] leading-3 text-de9-gray tabular-nums"
              style={{ height: PLOT_HEIGHT + 12 }}
            >
              {ticks.map((v) => (
                <span key={v} className="num">
                  {compact.format(v)}
                </span>
              ))}
            </div>

            <div className="relative" style={{ height: PLOT_HEIGHT }}>
              {ticks.map((v) => (
                <span
                  key={v}
                  aria-hidden
                  className={cn(
                    'pointer-events-none absolute inset-x-0 border-t',
                    v === 0 ? 'border-de9-line' : 'border-de9-line/50',
                  )}
                  style={{ bottom: `${(v / top) * 100}%` }}
                />
              ))}
              {max <= 0 && (
                <span className="absolute inset-0 flex items-center justify-center text-[12px] text-de9-gray">
                  {t('aucuneDonnee')}
                </span>
              )}
              <div className="absolute inset-0 flex">
                {bars.map((b, i) => (
                  <button
                    key={i}
                    type="button"
                    onPointerEnter={() => setActive(i)}
                    onPointerLeave={() => setActive(null)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    onClick={() => setActive(i)}
                    aria-label={`${b.label} — ${SERIES.map((s) => `${t(s.labelKey)} ${fmt(b[s.key])}`).join(' · ')}`}
                    className="relative flex h-full min-w-0 flex-1 cursor-default items-end justify-center gap-[2px] rounded-t-sm px-1 text-de9-ink"
                  >
                    {SERIES.map((s) => (
                      <span
                        key={s.key}
                        className={cn('block w-full max-w-6 rounded-t-[4px]', s.fill, b[s.key] > 0 && 'min-h-[2px]')}
                        style={{ height: `${(b[s.key] / top) * 100}%` }}
                      />
                    ))}
                    {active === i && (
                      // Beside the column, on whichever side has room, so it never covers the bars it describes.
                      <span
                        aria-hidden
                        className={cn(
                          'pointer-events-none absolute top-0 z-10 block min-w-[176px] rounded-md bg-popover px-3.5 py-2.5 text-start whitespace-nowrap shadow-e2',
                          i < bars.length / 2 ? 'start-full ms-1' : 'end-full me-1',
                        )}
                      >
                        <span className="block text-[11.5px] font-medium text-de9-gray">{b.label}</span>
                        {SERIES.map((s) => (
                          <span key={s.key} className="mt-1.5 flex items-center gap-2 text-[12px]">
                            <span className={cn('h-[3px] w-3 flex-none rounded-full', s.fill)} />
                            <span className="text-de9-slate">{t(s.labelKey)}</span>
                            <span className="num ms-auto ps-3 font-extrabold text-de9-ink tabular-nums">
                              {fmt(b[s.key])}
                            </span>
                          </span>
                        ))}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div />
            <div aria-hidden className="mt-2 flex">
              {bars.map((b, i) => (
                <span key={i} className="min-w-0 flex-1 truncate text-center text-[11px] font-medium text-de9-gray">
                  {b.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
