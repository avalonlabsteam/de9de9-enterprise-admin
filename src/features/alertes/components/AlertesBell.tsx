import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, Volume2, VolumeX, X } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { problemMessage } from '@/api/problem';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { dirOf, useLangStore } from '@/stores/langStore';
import { useAlertesFeed, useMarquerToutLu } from '../api/alertes';
import { ALERTE_CATEGORIES, type Alerte, type AlerteCategorie } from '../schemas/alertes';
import { alertesActions, sortAlertes, useAlertesStore } from '../stores/alertesStore';
import { alerteSonActions, useAlerteSonStore } from '../stores/sonStore';
import { CATEGORIE_LABEL, relativeTime, targetOf, tonStyle } from '../lib/alertes';
import { AlerteIcon } from './AlerteIcon';
import { openAlerte } from '../lib/actions';
import { playAlerteSon } from '../lib/son';

// Header bell + right-hand drawer (guide 11a §4.1–4.2). The badge and the chip
// counts come only from `compteurs`; the rows come from the store, which the
// drawer's pages, the catch-up and the live pushes all fill.

const RELATIVE_TICK_MS = 30_000;

export function AlertesBell() {
  const t = useT();
  const nonLues = useAlertesStore((s) => s.compteurs?.nonLues ?? 0);
  const open = useAlertesStore((s) => s.drawerOpen);
  const lang = useLangStore((s) => s.lang);

  return (
    <>
      <button
        type="button"
        onClick={() => alertesActions.setDrawerOpen(true)}
        aria-label={nonLues > 0 ? t('alertesBellAria').replace('{n}', String(nonLues)) : t('alertesTitre')}
        title={t('alertesTitre')}
        className="relative flex size-10 flex-none cursor-pointer items-center justify-center rounded-full text-on-surface-variant"
      >
        <Bell className="size-6" strokeWidth={1.75} />
        {nonLues > 0 && (
          <span className="absolute end-0.5 top-0.5 min-w-4 rounded-full bg-de9-red px-1 text-center text-[11px] leading-4 font-medium text-white">
            {nonLues > 99 ? '99+' : nonLues}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={alertesActions.setDrawerOpen}>
        <SheetContent
          side={dirOf(lang) === 'rtl' ? 'left' : 'right'}
          showCloseButton={false}
          className="max-w-full gap-0 bg-card p-0 data-[side=left]:w-[380px] data-[side=right]:w-[380px] data-[side=left]:sm:max-w-[380px] data-[side=right]:sm:max-w-[380px]"
        >
          <DrawerBody />
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Mounted only while the drawer is open: tab and chip start fresh on each open. */
function DrawerBody() {
  const t = useT();
  const navigate = useNavigate();
  const lang = useLangStore((s) => s.lang);
  const byId = useAlertesStore((s) => s.byId);
  const compteurs = useAlertesStore((s) => s.compteurs);
  const [nonLues, setNonLues] = useState(false);
  const [categorie, setCategorie] = useState<AlerteCategorie | null>(null);
  const filter = useMemo(() => ({ nonLues, categorie }), [nonLues, categorie]);
  const feed = useAlertesFeed(filter, true);
  const markAll = useMarquerToutLu();
  const son = useAlerteSonStore((s) => s.actif);
  // Switching it on plays the knock: the admin hears what a new alert will sound like.
  const toggleSon = (): void => {
    alerteSonActions.set(!son);
    if (!son) playAlerteSon(true);
  };
  const now = useNow();

  const rows = useMemo(
    () =>
      sortAlertes(
        Object.values(byId).filter((a) => (!nonLues || !a.lu) && (!categorie || a.categorie === categorie)),
      ),
    [byId, nonLues, categorie],
  );

  const unread = categorie ? (compteurs?.parCategorie?.[categorie] ?? 0) : (compteurs?.nonLues ?? 0);

  // Older rows: load the next page when the list's end scrolls into view.
  const scroller = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
      },
      { root: scroller.current, rootMargin: '120px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, rows.length]);

  const onMarkAll = (): void => {
    markAll.mutate(categorie, { onError: (err) => toast.error(problemMessage(err)) });
  };

  const pickCategorie = (c: AlerteCategorie): void => setCategorie((cur) => (cur === c ? null : c));

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ===== header ===== */}
      <div className="flex items-center gap-2 border-b border-de9-line px-4 pt-4 pb-3">
        <SheetTitle className="flex-1 text-[17px] font-extrabold text-de9-ink">{t('alertesTitre')}</SheetTitle>
        <SheetDescription className="sr-only">{t('alertesTitre')}</SheetDescription>
        {unread > 0 && (
          <button
            type="button"
            onClick={onMarkAll}
            disabled={markAll.isPending}
            className="cursor-pointer rounded-full px-2 py-1.5 text-[12px] font-bold text-de9-teal-dark hover:bg-de9-row disabled:cursor-default disabled:opacity-50"
          >
            {t('alertesToutMarquer')}
          </button>
        )}
        <button
          type="button"
          onClick={toggleSon}
          aria-label={t(son ? 'alertesSonCouper' : 'alertesSonActiver')}
          title={t(son ? 'alertesSonCouper' : 'alertesSonActiver')}
          className="flex size-8 flex-none cursor-pointer items-center justify-center rounded-full text-de9-gray hover:bg-de9-row hover:text-de9-slate"
        >
          {son ? <Volume2 className="size-[18px]" /> : <VolumeX className="size-[18px]" />}
        </button>
        <button
          type="button"
          onClick={() => alertesActions.setDrawerOpen(false)}
          aria-label={t('fermer')}
          className="flex size-8 flex-none cursor-pointer items-center justify-center rounded-full text-de9-gray hover:bg-de9-row hover:text-de9-slate"
        >
          <X className="size-[18px]" />
        </button>
      </div>

      {/* ===== tabs + chips ===== */}
      <div className="border-b border-de9-line px-4 pt-3 pb-2.5">
        <div className="flex gap-1 rounded-sm bg-secondary p-1">
          {[false, true].map((unreadOnly) => (
            <button
              key={String(unreadOnly)}
              type="button"
              aria-pressed={nonLues === unreadOnly}
              onClick={() => setNonLues(unreadOnly)}
              className={cn(
                'flex-1 cursor-pointer rounded-full py-1.5 text-[12.5px] font-bold',
                nonLues === unreadOnly ? 'bg-card text-de9-ink shadow-e1' : 'text-de9-gray hover:text-de9-slate',
              )}
            >
              {t(unreadOnly ? 'alertesNonLues' : 'alertesToutes')}
            </button>
          ))}
        </div>
        <div className="-mx-4 mt-2.5 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
          {ALERTE_CATEGORIES.map((c) => {
            const n = compteurs?.parCategorie?.[c] ?? 0;
            const active = categorie === c;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={active}
                onClick={() => pickCategorie(c)}
                className={cn(
                  'flex flex-none cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-[5px] text-[11.5px] font-bold whitespace-nowrap',
                  active
                    ? 'border-secondary-container bg-secondary-container text-on-secondary-container'
                    : n > 0
                      ? 'border-de9-line bg-card text-de9-slate'
                      : 'border-de9-line bg-card text-de9-gray opacity-60',
                )}
              >
                {t(CATEGORIE_LABEL[c])}
                {n > 0 && (
                  <span className={cn('text-[10.5px] font-extrabold', active ? 'text-white/80 dark:text-[#151923]/70' : 'text-de9-red')}>
                    {n > 99 ? '99+' : n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== rows ===== */}
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        {rows.map((a) => (
          <AlerteRow key={a.id} alerte={a} label={relativeTime(a.creeLe, lang, t('alertesALInstant'), now)} onOpen={() => openAlerte(a, navigate)} />
        ))}

        {rows.length === 0 && feed.isPending && (
          <div className="flex flex-col gap-2.5 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[62px] animate-pulse rounded-md bg-secondary" />
            ))}
          </div>
        )}

        {rows.length === 0 && feed.isError && (
          <div className="flex flex-col items-center gap-2.5 px-6 py-10 text-center">
            <div className="text-[13px] font-semibold text-de9-red">{problemMessage(feed.error)}</div>
            <button
              type="button"
              onClick={() => void feed.refetch()}
              className="cursor-pointer rounded-full border border-de9-line px-3.5 py-1.5 text-[12.5px] font-bold text-de9-slate hover:bg-de9-row"
            >
              {t('kycReessayer')}
            </button>
          </div>
        )}

        {rows.length === 0 && feed.isSuccess && (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center text-de9-gray">
            <Bell className="size-7 opacity-50" />
            <div className="text-[13px] font-semibold">{t('alertesAucune')}</div>
          </div>
        )}

        {hasNextPage && <div ref={sentinel} className="h-px" />}
        {isFetchingNextPage && (
          <div className="p-3">
            <div className="h-[52px] animate-pulse rounded-md bg-secondary" />
          </div>
        )}
      </div>
    </div>
  );
}

function AlerteRow({ alerte: a, label, onOpen }: { alerte: Alerte; label: string; onOpen: () => void }) {
  const t = useT();
  const style = tonStyle(a.ton);
  const opens = targetOf(a) !== null;
  return (
    <button
      type="button"
      onClick={onOpen}
      // A row with no target only informs: tapping it just marks it read.
      disabled={!opens && a.lu}
      className={cn(
        'flex w-full items-start gap-3 border-b border-de9-line px-4 py-3 text-start',
        opens || !a.lu ? 'cursor-pointer hover:bg-de9-row' : 'cursor-default',
        !a.lu && 'bg-[#F5F9FE] dark:bg-[#2F7FD0]/[.06]',
      )}
    >
      <div className={cn('flex size-9 flex-none items-center justify-center rounded-sm', style.tile)}>
        <AlerteIcon icone={a.icone} className="size-[17px]" />
      </div>
      <div className="min-w-0 flex-1">
        {/* The server writes these in French: `dir="auto"` keeps their punctuation in place in the Arabic UI. */}
        <div
          dir="auto"
          className={cn('text-[13px] leading-snug', a.lu ? 'font-semibold text-de9-slate' : 'font-extrabold text-de9-ink')}
        >
          {a.titre}
        </div>
        {a.texte && (
          <div dir="auto" className="mt-0.5 line-clamp-2 text-[12px] leading-[1.4] text-de9-gray">
            {a.texte}
          </div>
        )}
        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-de9-gray">
          {a.acteur?.nom && (
            <>
              <span dir="auto" className="truncate font-bold text-de9-slate">
                {a.acteur.nom}
              </span>
              <span aria-hidden>·</span>
            </>
          )}
          <span className="flex-none">{label}</span>
        </div>
      </div>
      <div className="flex flex-none flex-col items-center gap-2 self-stretch pt-1">
        {!a.lu && <span className="size-2 rounded-full bg-[#2F7FD0]" aria-label={t('alertesNonLue')} />}
        {opens && <ChevronRight className="mt-auto mb-auto size-4 text-de9-gray rtl:rotate-180" />}
      </div>
    </button>
  );
}

/** « il y a 5 min » keeps moving while the drawer is open. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), RELATIVE_TICK_MS);
    return () => clearInterval(id);
  }, []);
  return now;
}
