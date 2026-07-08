import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useT, useL } from '@/lib/i18n';
import { useLangStore, type Lang } from '@/stores/langStore';
import { useHandicapWorkers } from '../api/handicap';
import type { HandicapWorker } from '../schemas/handicap';

/* ---- date helper ported from logic.ts dayName()/withDay() ---- */
const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function withDay(s: string, lang: Lang): string {
  const m = s.match(/(\d{2}\/\d{2}\/\d{4})/);
  if (!m) return s;
  const p = m[1].split('/');
  const dt = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
  if (Number.isNaN(dt.getTime())) return s;
  const d = (lang === 'ar' ? DAYS_AR : DAYS_FR)[dt.getDay()];
  return s.replace(m[1], d + ' ' + m[1]);
}

const GRID_COLS =
  '[grid-template-columns:1.3fr_1.2fr_1.6fr_0.6fr_1fr_1fr_1.4fr_0.9fr_0.8fr]';

export function HandicapPage() {
  const t = useT();
  const L = useL();
  const lang = useLangStore((s) => s.lang);
  const { data, isPending, isError } = useHandicapWorkers();
  const [search, setSearch] = useState('');
  // Contacted is UI state in the prototype (state.hcContacted, seeded via `contacted` on the row).
  const [contactedOverrides, setContactedOverrides] = useState<Record<string, boolean>>({});
  const [, setSearchParams] = useSearchParams();

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list: HandicapWorker[] = data ?? [];
    if (q) {
      list = list.filter(
        (w) =>
          w.entreprise.toLowerCase().includes(q) ||
          w.poste.toLowerCase().includes(q) ||
          w.zone.toLowerCase().includes(q),
      );
    }
    return list;
  }, [data, search]);

  const isContacted = (w: HandicapWorker): boolean => contactedOverrides[w.id] ?? w.contacted;

  const toggleContacted = (w: HandicapWorker): void => {
    setContactedOverrides((s) => ({ ...s, [w.id]: !(s[w.id] ?? w.contacted) }));
  };

  const openPresByName = (name: string): void => {
    if (!name || name === '—') return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('pres', name);
      return next;
    });
  };

  return (
    <div>
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-[14px]">
        <div>
          <div className="text-[23px] font-extrabold">{t('hcTitre')}</div>
          <div className="mt-[2px] text-[13.5px] text-de9-gray">{t('hcSub')}</div>
        </div>
      </div>

      {/* confidential chip */}
      <div className="mt-[14px] inline-flex items-center gap-[7px] rounded-[10px] border border-[#CFE0F5] bg-[#EAF2FD] px-[13px] py-2 text-[11.5px] font-bold text-[#2C6FB0] dark:border-[#2F7FD0]/40 dark:bg-[#2F7FD0]/15 dark:text-[#7EB5EC]">
        🔒 {t('hcConfid')}
      </div>

      {/* search + count */}
      <div className="mt-[14px] flex flex-wrap items-center gap-[9px]">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('hcRecherche')}
          className="w-full flex-none rounded-[11px] border-[1.5px] border-de9-line bg-card px-[15px] py-[10px] text-[12.5px] text-de9-ink outline-none sm:w-[300px]"
        />
        <div className="text-[12.5px] font-semibold text-de9-gray">
          {rows.length} {t('hcCount')}
        </div>
      </div>

      {/* table card */}
      <div className="mt-3 overflow-x-auto rounded-[18px] border border-de9-line bg-card shadow-[0_10px_30px_rgba(38,50,69,.06)]">
        <div className="min-w-[1040px]">
          <div
            className={`grid ${GRID_COLS} gap-[10px] border-b border-de9-line bg-secondary px-5 py-[13px] text-[10px] font-bold uppercase tracking-[.03em] text-de9-gray`}
          >
            <div>{t('hcColEntreprise')}</div>
            <div>{t('hcColContact')}</div>
            <div>{t('hcColPoste')}</div>
            <div className="text-center">{t('hcColNombre')}</div>
            <div>{t('hcColZone')}</div>
            <div>{t('hcColDate')}</div>
            <div>{t('hcColComment')}</div>
            <div className="text-center">{t('hcColContacter')}</div>
            <div className="text-center">{t('hcColContacte')}</div>
          </div>

          {isPending && (
            <div className="px-5 py-[13px]">
              {[0, 1, 2].map((i) => (
                <div key={i} className="mb-[13px] h-9 animate-pulse rounded-[9px] bg-de9-row" />
              ))}
            </div>
          )}

          {isError && !isPending && (
            <div className="px-5 py-[13px] text-[12.5px] font-semibold text-de9-red">
              {L('Erreur de chargement de la liste', 'خطأ في تحميل القائمة')}
            </div>
          )}

          {!isPending &&
            !isError &&
            rows.map((w) => {
              const contacted = isContacted(w);
              return (
                <div
                  key={w.id}
                  className={`grid ${GRID_COLS} items-center gap-[10px] border-b border-de9-line px-5 py-[13px]`}
                >
                  <div className="text-[12.5px] font-bold">
                    <span
                      onClick={() => openPresByName(w.entreprise)}
                      className="cursor-pointer underline decoration-[#C7CFD7] decoration-dotted underline-offset-[3px]"
                    >
                      {w.entreprise}
                    </span>
                  </div>
                  <div className="text-[12px] text-de9-slate">
                    {w.contact}
                    <div className="text-[10.5px] text-de9-gray">{w.phone}</div>
                  </div>
                  <div className="text-[12px] text-de9-slate">{w.poste}</div>
                  <div className="text-center text-[12.5px] font-bold">{w.nombre || '—'}</div>
                  <div className="text-[12px] text-de9-slate">{w.zone}</div>
                  <div className="text-[12px] text-de9-slate">{withDay(w.date, lang)}</div>
                  <div className="text-[11.5px] leading-[1.4] text-de9-gray">
                    {w.commentaire || '—'}
                  </div>
                  <div className="flex items-center justify-center gap-[6px]">
                    <a
                      href={'tel:+213' + w.phone.replace(/^0/, '')}
                      className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] border-[1.5px] border-de9-line text-[13px] no-underline"
                    >
                      📞
                    </a>
                    <a
                      href={'https://wa.me/' + w.wa}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] border-[1.5px] border-de9-line text-[13px] no-underline"
                    >
                      💬
                    </a>
                  </div>
                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => toggleContacted(w)}
                      className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded-[7px] border-2 text-[13px] font-extrabold text-white ${
                        contacted
                          ? 'border-[#2FA86A] bg-[#2FA86A]'
                          : 'border-[#CBD3DB] bg-card dark:border-de9-line'
                      }`}
                    >
                      {contacted ? '✓' : ''}
                    </button>
                  </div>
                </div>
              );
            })}

          {!isPending && !isError && rows.length === 0 && (
            <div className="p-[44px] text-center text-[14px] text-de9-gray">{t('hcAucun')}</div>
          )}
        </div>
      </div>
    </div>
  );
}
