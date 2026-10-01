import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { ACTIONS, ACTION_ORDER, plural, type AccesAction } from '../lib/acces';
import { accesSelection, useAccesSelection } from '../stores/selectionStore';

const BTN =
  'cursor-pointer rounded-full px-2.5 py-[10px] text-center text-[12px] leading-tight font-bold lg:flex-none lg:px-4 lg:text-[12.5px] lg:whitespace-nowrap';

/** Grant: primary. Restore: tonal. Revoke and suspend: danger outline. */
const BTN_STYLE: Record<AccesAction, string> = {
  b2c_accorder: 'bg-primary text-primary-foreground',
  b2c_retirer: 'border border-de9-red bg-card text-de9-red',
  b2b_activer: 'bg-secondary-container text-on-secondary-container',
  b2b_desactiver: 'border border-de9-red bg-card text-de9-red',
};

interface AccesSelectionBarProps {
  onAction: (action: AccesAction) => void;
}

/**
 * Fixed bottom bar shown while the selection is non-empty. The four buttons
 * are always there: the server skips, company by company, what is already in
 * the asked state.
 */
export function AccesSelectionBar({ onAction }: AccesSelectionBarProps) {
  const t = useT();
  const selected = useAccesSelection((s) => s.selected);
  if (!selected.size) return null;

  const names = [...selected.values()].map((s) => s.nom).join(', ');

  return (
    <div className="fixed inset-x-3 bottom-[22px] z-[80] flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-md border border-de9-line bg-card px-4 py-3 shadow-e3 lg:inset-x-auto lg:left-1/2 lg:w-max lg:max-w-[94vw] lg:-translate-x-1/2">
      <div className="flex-none text-[13px] font-extrabold text-de9-ink">
        {plural(selected.size, 'accesSelection1', 'accesSelectionN', t)}
      </div>
      <div
        dir="auto"
        title={names}
        className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] text-de9-gray ltr:text-left rtl:text-right lg:max-w-[200px] lg:flex-none"
      >
        {names}
      </div>
      {/* A phone stacks the buttons two by two under the count; « Vider » then stays on the first line. */}
      <button
        type="button"
        onClick={() => accesSelection.clear()}
        className="flex-none cursor-pointer text-[12px] font-bold text-de9-gray lg:order-last"
      >
        {t('presVider')}
      </button>
      <div className="grid w-full grid-cols-2 gap-2 lg:flex lg:w-auto lg:items-center">
        {ACTION_ORDER.map((action) => (
          <button key={action} type="button" onClick={() => onAction(action)} className={cn(BTN, BTN_STYLE[action])}>
            {t(ACTIONS[action].labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}
