// V2 → V3 « Affecter un ouvrier » for a live visit: POST
// /commandes/worklist/{id}/affecter-ouvrier takes `teamMemberIds`, several of
// them (live visits carry two workers), so this is a multi-select by id.
// ActionModals' AssignModal stays as it is — the mock console picks one worker
// by name. Visual ground truth: src/admin/views/Console.tsx modals.
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { EquipeMember } from '../../api/commandes';

interface AssignTeamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: EquipeMember[];
  /** Ids already assigned, preselected when the form opens. */
  initialSelected?: string[];
  pending: boolean;
  onConfirm: (members: EquipeMember[]) => void;
}

export function AssignTeamModal({
  open,
  onOpenChange,
  members,
  initialSelected = [],
  pending,
  onConfirm,
}: AssignTeamModalProps) {
  const t = useT();
  const [selected, setSelected] = useState<string[]>(initialSelected);

  const toggle = (id: string): void =>
    setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="block max-h-[90vh] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-[22px] bg-card p-[26px] shadow-[0_30px_70px_rgba(20,30,45,.4)] ring-0 sm:max-w-[460px]"
      >
        <div className="flex size-[54px] items-center justify-center rounded-[15px] bg-[#E7F6EE] text-[26px] dark:bg-[#2FA86A]/15">
          👷
        </div>
        <DialogTitle className="mt-4 text-[19px] font-extrabold leading-normal text-de9-ink">
          {t('titleAssign')}
        </DialogTitle>
        <div className="mt-[9px] text-[13px] leading-[1.55] text-de9-slate">{t('assignInfoMulti')}</div>

        <div className="mt-4 flex flex-col gap-[9px]">
          {members.map((m) => {
            const active = selected.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                role="checkbox"
                aria-checked={active}
                onClick={() => toggle(m.id)}
                className={cn(
                  'flex cursor-pointer items-center gap-[11px] rounded-xl border-[1.5px] px-[15px] py-[13px] text-start',
                  active ? 'border-[#2FA86A] bg-[#E7F6EE] dark:bg-[#2FA86A]/15' : 'border-de9-line bg-card',
                )}
              >
                <span className={cn('text-base', active ? 'text-[#2FA86A] dark:text-[#6FCF97]' : 'text-[#B6BEC8]')}>
                  {active ? '☑' : '☐'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-de9-ink">{m.name}</span>
                  {m.skill && <span className="block text-[11.5px] text-de9-gray">{m.skill}</span>}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-[22px] flex gap-[11px]">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-auto flex-1 rounded-[13px] bg-secondary p-3.5 text-center text-sm font-bold text-de9-slate hover:bg-secondary"
          >
            {t('annuler')}
          </Button>
          <Button
            type="button"
            disabled={pending || selected.length === 0}
            onClick={() => onConfirm(members.filter((m) => selected.includes(m.id)))}
            className="h-auto flex-1 rounded-[13px] bg-[#2FA86A] p-3.5 text-center text-sm font-bold text-white shadow-[0_10px_22px_rgba(47,168,106,.38)] hover:bg-[#29955E] disabled:opacity-70"
          >
            {t('btnAssign')}
            {selected.length > 0 ? ` (${selected.length})` : ''}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
