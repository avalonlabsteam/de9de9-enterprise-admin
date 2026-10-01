import type { KeyboardEvent, MouseEvent } from 'react';
import { BellRing, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import type { Alerte } from '../schemas/alertes';
import { targetOf, tonStyle } from '../lib/alertes';
import { AlerteIcon } from './AlerteIcon';

// The console's dark toast (guide 11a §4.3): icon · titre · the company ·
// texte on two lines · « Ouvrir » for `action`. A tap anywhere is a tap on the
// row; ✕ only dismisses — it does not mark the alert read.

const shell =
  'flex w-[356px] max-w-[calc(100vw-32px)] cursor-pointer items-start gap-3 rounded-md border-s-4 bg-[rgb(35_40_56)] px-3.5 py-3 dark:ring-1 dark:ring-white/10 text-start text-white shadow-e3 outline-none focus-visible:ring-2 focus-visible:ring-white/60';

function onActivate(fn: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  };
}

function stop(fn: () => void) {
  return (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };
}

function CloseButton({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={stop(onClose)}
      aria-label={t('fermer')}
      className="-me-1 -mt-0.5 flex size-7 flex-none cursor-pointer items-center justify-center rounded-full text-[#A6AEBD] hover:bg-white/10 hover:text-white"
    >
      <X className="size-4" />
    </button>
  );
}

export function AlerteToast({ alerte: a, onOpen, onClose }: { alerte: Alerte; onOpen: () => void; onClose: () => void }) {
  const t = useT();
  const style = tonStyle(a.ton);
  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={onActivate(onOpen)} className={cn(shell, style.edge)}>
      <div className={cn('flex size-9 flex-none items-center justify-center rounded-sm', style.toastTile)}>
        <AlerteIcon icone={a.icone} className="size-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        {/* The server writes these in French: `dir="auto"` keeps their punctuation in place in the Arabic UI. */}
        <div dir="auto" className="text-[13px] leading-snug font-extrabold">
          {a.titre}
        </div>
        {a.acteur?.nom && (
          <div dir="auto" className="mt-0.5 text-[11.5px] font-semibold text-[#A6AEBD]">
            {a.acteur.nom}
          </div>
        )}
        {a.texte && (
          <div dir="auto" className="mt-1 line-clamp-2 text-[12px] leading-[1.4] text-[#D5DAE3]">
            {a.texte}
          </div>
        )}
        {a.ton === 'action' && targetOf(a) && (
          <button
            type="button"
            onClick={stop(onOpen)}
            className="mt-2 cursor-pointer rounded-full bg-white px-3 py-1.5 text-[12px] font-extrabold text-[rgb(35_40_56)] hover:bg-[#EEF1F4]"
          >
            {t('alertesOuvrir')}
          </button>
        )}
      </div>
      <CloseButton onClose={onClose} />
    </div>
  );
}

/** « {n} nouvelles alertes » — a burst, or what a catch-up brought. Opens the drawer. */
export function AlertesSummaryToast({ n, onOpen, onClose }: { n: number; onOpen: () => void; onClose: () => void }) {
  const t = useT();
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={onActivate(onOpen)}
      className={cn(shell, 'items-center border-s-[#65CBC4]')}
    >
      <div className="flex size-9 flex-none items-center justify-center rounded-sm bg-[#65CBC4]/20 text-[#9FE0DB]">
        <BellRing className="size-[18px]" />
      </div>
      <div className="min-w-0 flex-1 text-[13px] font-extrabold">{t('alertesNouvelles').replace('{n}', String(n))}</div>
      <CloseButton onClose={onClose} />
    </div>
  );
}
