// Console action modals — visual ground truth: src/admin/views/ActionModals.tsx
// (approve / reprogram / assign / choose / deposit / viewFacture). Each modal is
// a controlled shadcn Dialog; forms use react-hook-form + zodResolver. The
// mutations themselves are fired by ConsolePage (useCommandeAction/useDevisAction)
// through the onConfirm/onSubmit callbacks.
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useT, useL } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldError } from '@/components/ui/field';

const CONTENT_CLASS =
  'block max-h-[88vh] w-full max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-[22px] bg-card p-7 text-de9-ink shadow-[0_30px_70px_rgba(20,30,45,.35)] ring-0 sm:max-w-[460px]';

const CANCEL_CLASS =
  'h-auto flex-1 rounded-[13px] bg-secondary p-3.5 text-center text-sm font-bold text-de9-slate hover:bg-de9-bg hover:text-de9-slate';

const LABEL_CLASS = 'mb-1.5 text-xs font-semibold text-de9-slate';

const INPUT_CLASS =
  'h-auto w-full rounded-xl border-[1.5px] border-de9-line bg-card p-3 text-sm text-de9-ink shadow-none md:text-sm';

interface IconTileProps {
  bg: string;
  icon: string;
}

function IconTile({ bg, icon }: IconTileProps) {
  return (
    <div className="flex h-[54px] w-[54px] items-center justify-center rounded-[15px] text-[26px]" style={{ background: bg }}>
      {icon}
    </div>
  );
}

interface BaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ===================== APPROVE =====================

export function ApproveModal({
  open,
  onOpenChange,
  pending,
  onConfirm,
}: BaseModalProps & { pending: boolean; onConfirm: () => void }) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className={CONTENT_CLASS}>
        <IconTile bg="#EAF2FD" icon="⚖️" />
        <DialogTitle className="mt-4 text-[19px] font-extrabold leading-normal text-de9-ink">
          {t('modalTitle')}
        </DialogTitle>
        <div className="mt-[9px] text-[13.5px] leading-[1.55] text-de9-slate">{t('modalBody')}</div>
        <div className="mt-4 rounded-xl border border-[#F0E2C0] bg-[#FBF4E4] px-[15px] py-[13px] text-[12.5px] leading-[1.5] text-[#92702A] dark:border-[#92702A]/40 dark:bg-[#92702A]/15 dark:text-[#D9B36A]">
          {t('modalWarn')}
        </div>
        <div className="mt-[22px] flex gap-[11px]">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className={CANCEL_CLASS}>
            {t('annuler')}
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className="h-auto flex-1 rounded-[13px] bg-[#2F7FD0] p-3.5 text-center text-sm font-bold text-white shadow-[0_10px_22px_rgba(47,127,208,.4)] hover:bg-[#2870B8] disabled:opacity-70"
          >
            {t('confirmerAuNom')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===================== REPROGRAM =====================

const reprogramSchema = z.object({ date: z.string().min(1), time: z.string() });
export type ReprogramValues = z.infer<typeof reprogramSchema>;

export function ReprogramModal({
  open,
  onOpenChange,
  defaultDate,
  onSubmit,
}: BaseModalProps & { defaultDate: string; onSubmit: (values: ReprogramValues) => Promise<void> }) {
  const t = useT();
  const l = useL();
  const form = useForm<ReprogramValues>({
    resolver: zodResolver(reprogramSchema),
    defaultValues: { date: defaultDate, time: '09:00' },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className={CONTENT_CLASS}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <IconTile bg="#FEF3E2" icon="🗓️" />
          <DialogTitle className="mt-4 text-[19px] font-extrabold leading-normal text-de9-ink">
            {t('titleReprog')}
          </DialogTitle>
          <div className="mt-[9px] text-[13px] leading-[1.55] text-de9-slate">{t('reprogInfo')}</div>
          <div className="mt-[18px] grid grid-cols-1 gap-3 sm:grid-cols-[1fr_130px]">
            <Field className="gap-0">
              <div className={LABEL_CLASS}>{t('dateLabel')}</div>
              <Input
                type="date"
                {...form.register('date')}
                aria-invalid={!!form.formState.errors.date}
                className={INPUT_CLASS}
              />
              <div className="min-h-[18px] pt-0.5">
                {form.formState.errors.date && (
                  <FieldError className="text-[11.5px] font-semibold text-de9-red">
                    {l('Choisissez une date', 'اختر تاريخاً')}
                  </FieldError>
                )}
              </div>
            </Field>
            <Field className="gap-0">
              <div className={LABEL_CLASS}>{t('heureLabel')}</div>
              <Input type="time" {...form.register('time')} className={INPUT_CLASS} />
              <div className="min-h-[18px]" />
            </Field>
          </div>
          <div className="mt-[10px] flex gap-[11px]">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className={CANCEL_CLASS}>
              {t('annuler')}
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="h-auto flex-1 rounded-[13px] bg-[#D9871F] p-3.5 text-center text-sm font-bold text-white shadow-[0_10px_22px_rgba(217,135,31,.38)] hover:bg-[#C67A19] disabled:opacity-70"
            >
              {t('btnReprog')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ===================== ASSIGN =====================

export function AssignModal({
  open,
  onOpenChange,
  workers,
  initialWorker,
  pending,
  onConfirm,
}: BaseModalProps & {
  workers: readonly string[];
  initialWorker: string;
  pending: boolean;
  onConfirm: (worker: string) => void;
}) {
  const t = useT();
  const [worker, setWorker] = useState(initialWorker);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className={CONTENT_CLASS}>
        <IconTile bg="#E7F6EE" icon="👷" />
        <DialogTitle className="mt-4 text-[19px] font-extrabold leading-normal text-de9-ink">
          {t('titleAssign')}
        </DialogTitle>
        <div className="mt-[9px] text-[13px] leading-[1.55] text-de9-slate">{t('assignInfo')}</div>
        <div className="mt-4 flex flex-col gap-[9px]" role="radiogroup">
          {workers.map((w) => {
            const active = w === worker;
            return (
              <button
                key={w}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setWorker(w)}
                className={cn(
                  'flex cursor-pointer items-center gap-[11px] rounded-xl border-[1.5px] px-[15px] py-[13px] text-start',
                  active ? 'border-[#2FA86A] bg-[#E7F6EE] dark:bg-[#2FA86A]/15' : 'border-de9-line bg-card',
                )}
              >
                <span className={cn('text-base', active ? 'text-[#2FA86A] dark:text-[#6FCF97]' : 'text-[#B6BEC8]')}>
                  {active ? '●' : '○'}
                </span>
                <span className="text-sm font-bold text-de9-ink">{w}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-[22px] flex gap-[11px]">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className={CANCEL_CLASS}>
            {t('annuler')}
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => onConfirm(worker)}
            className="h-auto flex-1 rounded-[13px] bg-[#2FA86A] p-3.5 text-center text-sm font-bold text-white shadow-[0_10px_22px_rgba(47,168,106,.38)] hover:bg-[#29955E] disabled:opacity-70"
          >
            {t('btnAssign')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===================== CHOOSE (candidate quote) =====================

export interface ChooseQuoteVM {
  raison: string;
  montantLabel: string;
  delai: string;
  note: string;
}

export function ChooseModal({
  open,
  onOpenChange,
  quotes,
  defaultIndex,
  pending,
  onConfirm,
}: BaseModalProps & {
  quotes: ChooseQuoteVM[];
  defaultIndex: number;
  pending: boolean;
  onConfirm: (quoteIndex: number) => void;
}) {
  const t = useT();
  const [idx, setIdx] = useState(defaultIndex);

  const confirm = (): void => {
    if (idx < 0) {
      toast.error(t('consoleToastSelectionnezCandidat'));
      return;
    }
    onConfirm(idx);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className={CONTENT_CLASS}>
        <IconTile bg="#E5F7F4" icon="🤝" />
        <DialogTitle className="mt-4 text-[19px] font-extrabold leading-normal text-de9-ink">
          {t('titleChoose')}
        </DialogTitle>
        <div className="mt-[9px] text-[13px] leading-[1.55] text-de9-slate">{t('chooseInfo')}</div>
        <div className="mt-4 flex flex-col gap-[9px]" role="radiogroup">
          {quotes.map((q, i) => {
            const active = i === idx;
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setIdx(i)}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-xl border-[1.5px] px-[15px] py-[13px] text-start',
                  active ? 'border-[#2FA86A] bg-[#EDF8F1] dark:bg-[#2FA86A]/15' : 'border-de9-line bg-card',
                )}
              >
                <div className="flex-1">
                  <div className="text-sm font-bold">{q.raison}</div>
                  <div className="text-[11.5px] text-de9-gray">
                    {q.note} · {q.delai}
                  </div>
                </div>
                <div className="text-[15px] font-extrabold">{q.montantLabel}</div>
              </button>
            );
          })}
        </div>
        <div className="mt-[22px] flex gap-[11px]">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className={CANCEL_CLASS}>
            {t('annuler')}
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={confirm}
            className="h-auto flex-1 rounded-[13px] bg-[#65CBC4] p-3.5 text-center text-sm font-bold text-white shadow-[0_10px_22px_rgba(101,203,196,.42)] hover:bg-[#58BBB4] disabled:opacity-70"
          >
            {t('btnChoose')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===================== DEPOSIT (facture) =====================

const depositSchema = z.object({
  montant: z.number().positive(),
  fileName: z.string(),
  note: z.string(),
});
export type DepositValues = z.infer<typeof depositSchema>;

export function DepositModal({
  open,
  onOpenChange,
  defaultMontant,
  onSubmit,
}: BaseModalProps & { defaultMontant: number; onSubmit: (values: DepositValues) => Promise<void> }) {
  const t = useT();
  const l = useL();
  const form = useForm<DepositValues>({
    resolver: zodResolver(depositSchema),
    defaultValues: { montant: defaultMontant, fileName: '', note: '' },
  });
  const fileName = form.watch('fileName');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className={CONTENT_CLASS}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <IconTile bg="#F4EFFB" icon="🧾" />
          <DialogTitle className="mt-4 text-[19px] font-extrabold leading-normal text-de9-ink">
            {t('titleDeposit')}
          </DialogTitle>
          <div className="mt-[9px] text-[13px] leading-[1.55] text-de9-slate">{t('depositInfo')}</div>

          <div className="mt-4">
            <div className={LABEL_CLASS}>{t('fileLabel')}</div>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border-[1.5px] border-dashed border-de9-line p-3.5">
              <span className="text-lg">📎</span>
              <span className="truncate text-[13px] font-semibold text-de9-slate">
                {fileName || t('choisirFichier')}
              </span>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files && e.target.files[0];
                  form.setValue('fileName', f ? f.name : '');
                }}
              />
            </label>
          </div>

          <Field className="mt-3.5 gap-0">
            <div className={LABEL_CLASS}>{t('montantLabel')}</div>
            <Input
              type="number"
              {...form.register('montant', { valueAsNumber: true })}
              aria-invalid={!!form.formState.errors.montant}
              className={INPUT_CLASS}
            />
            <div className="min-h-[18px] pt-0.5">
              {form.formState.errors.montant && (
                <FieldError className="text-[11.5px] font-semibold text-de9-red">
                  {l('Montant invalide', 'مبلغ غير صالح')}
                </FieldError>
              )}
            </div>
          </Field>

          <div className="mt-1.5">
            <div className={LABEL_CLASS}>{t('noteLabel')}</div>
            <Input {...form.register('note')} placeholder={t('optionnel')} className={INPUT_CLASS} />
          </div>

          <div className="mt-[22px] flex gap-[11px]">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className={CANCEL_CLASS}>
              {t('annuler')}
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="h-auto flex-1 rounded-[13px] bg-[#7C57C7] p-3.5 text-center text-sm font-bold text-white shadow-[0_10px_22px_rgba(124,87,199,.38)] hover:bg-[#6C49B5] disabled:opacity-70"
            >
              {t('btnDeposit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ===================== VIEW FACTURE =====================

export interface ViewFactureVM {
  dateLabel: string;
  fileName: string;
  montantLabel: string;
  proLabel: string;
  margeLabel: string;
  transfere: boolean;
  statusLabel: string;
  statusBg: string;
  statusFg: string;
}

export function ViewFactureModal({
  open,
  onOpenChange,
  fact,
}: BaseModalProps & { fact: ViewFactureVM }) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className={CONTENT_CLASS}>
        <div className="flex items-center justify-between">
          <DialogTitle className="text-[19px] font-extrabold leading-normal text-de9-ink">
            {t('titleView')}
          </DialogTitle>
          <span className="text-xs text-de9-gray">{fact.dateLabel}</span>
        </div>
        <div className="mt-3.5 overflow-hidden rounded-[14px] border-[1.5px] border-de9-line">
          <div className="border-b border-de9-line bg-secondary p-7 text-center">
            <div className="text-[42px]">📄</div>
            <div className="mt-2 text-[13px] font-bold text-de9-slate">{fact.fileName}</div>
            <div className="text-[11px] text-de9-gray">{t('apercu')}</div>
          </div>
          <div className="px-[18px] py-4">
            <div className="mb-2.5 flex justify-between text-sm">
              <span className="text-de9-gray">{t('montantLabel')}</span>
              <b className="text-base">{fact.montantLabel} cr</b>
            </div>
            <div className="rounded-[10px] bg-secondary px-[13px] py-[11px] text-xs leading-[1.6] text-de9-slate">
              {t('ventilation')} : <b>{fact.montantLabel}</b> {t('client')} →{' '}
              <b className="text-[#2FA86A] dark:text-[#6FCF97]">{fact.proLabel}</b> {t('pro')} (85%) ·{' '}
              <b className="text-de9-red">{fact.margeLabel}</b> de9de9 (15%)
            </div>
            <div className="mt-[13px] flex items-center gap-2">
              <span
                className="rounded-full px-[11px] py-[5px] text-[11px] font-bold"
                style={{ background: fact.statusBg, color: fact.statusFg }}
              >
                {fact.statusLabel}
              </span>
              {fact.transfere && (
                <span className="rounded-full bg-[#2FA86A] px-[11px] py-[5px] text-[11px] font-extrabold text-white">
                  {t('transfere')}
                </span>
              )}
            </div>
          </div>
        </div>
        <Button
          type="button"
          onClick={() => onOpenChange(false)}
          className="mt-5 h-auto w-full rounded-[13px] bg-[#232838] p-3.5 text-center text-sm font-bold text-white hover:bg-[#1A1F2C]"
        >
          {t('btnClose')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
