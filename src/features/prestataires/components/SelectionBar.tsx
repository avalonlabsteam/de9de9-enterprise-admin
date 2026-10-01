import { useT } from '@/lib/i18n';
import { useSelectionStore, selectionActions } from '../stores/selectionStore';

interface SelectionBarProps {
  onRequestQuotes: () => void;
}

/** Fixed bottom bar shown while the selection is non-empty (logic.ts presSel). */
export function SelectionBar({ onRequestQuotes }: SelectionBarProps) {
  const t = useT();
  const selected = useSelectionStore((s) => s.selected);
  const storedNames = useSelectionStore((s) => s.names);
  if (!selected.length) return null;

  const names = selected.map((id) => storedNames[id] ?? id).join(', ');

  return (
    <div className="fixed inset-x-3 bottom-[22px] z-[80] flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-md border border-de9-line bg-card px-4 py-3 shadow-e3 sm:inset-x-auto sm:left-1/2 sm:max-w-[94vw] sm:-translate-x-1/2 sm:flex-nowrap">
      <div className="flex-none text-[13px] font-extrabold text-de9-ink">
        {selected.length} {t('presSelectionne')}
      </div>
      <div className="min-w-0 max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] text-de9-gray">
        {names}
      </div>
      <button
        type="button"
        onClick={() => selectionActions.clear()}
        className="flex-none cursor-pointer text-[12px] font-bold text-de9-gray"
      >
        {t('presVider')}
      </button>
      <button
        type="button"
        onClick={onRequestQuotes}
        className="flex-none cursor-pointer rounded-full bg-de9-teal px-[18px] py-[11px] text-[12.5px] font-bold text-white"
      >
        {t('presDemanderDevisN')} ({selected.length})
      </button>
    </div>
  );
}
