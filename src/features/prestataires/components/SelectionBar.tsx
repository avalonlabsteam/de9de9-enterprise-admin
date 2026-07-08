import { toast } from 'sonner';
import { useT } from '@/lib/i18n';
import type { Prestataire } from '../schemas/prestataire';
import { useSelectionStore, selectionActions } from '../stores/selectionStore';

interface SelectionBarProps {
  prestataires: Prestataire[];
  onRequestQuotes: () => void;
}

/** Fixed bottom bar shown while the selection is non-empty (logic.ts presSel). */
export function SelectionBar({ prestataires, onRequestQuotes }: SelectionBarProps) {
  const t = useT();
  const selected = useSelectionStore((s) => s.selected);
  if (!selected.length) return null;

  const names = selected
    .map((id) => prestataires.find((p) => p.id === id)?.name)
    .filter((n): n is string => !!n)
    .join(', ');

  // logic.ts proposeClient — toast '{n} prestataire(s) proposé(s) au client'
  const proposeClient = () => {
    toast.success(t('presToastProposesClient').replace('{n}', String(selected.length)));
  };

  return (
    <div className="fixed inset-x-3 bottom-[22px] z-[80] flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-2xl border-[1.5px] border-de9-line bg-card px-4 py-3 shadow-[0_18px_44px_rgba(20,30,45,.22)] sm:inset-x-auto sm:left-1/2 sm:max-w-[94vw] sm:-translate-x-1/2 sm:flex-nowrap">
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
        onClick={proposeClient}
        className="flex-none cursor-pointer rounded-xl bg-[#EAF2FD] px-4 py-[11px] text-[12.5px] font-bold text-[#2F7FD0] dark:bg-[#2F7FD0]/15 dark:text-[#7EB5EC]"
      >
        {t('proposerClient')}
      </button>
      <button
        type="button"
        onClick={onRequestQuotes}
        className="flex-none cursor-pointer rounded-xl bg-de9-teal px-[18px] py-[11px] text-[12.5px] font-bold text-white shadow-[0_8px_18px_rgba(101,203,196,.4)]"
      >
        {t('presDemanderDevisN')} ({selected.length})
      </button>
    </div>
  );
}
