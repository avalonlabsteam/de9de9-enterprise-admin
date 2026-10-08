// Small pieces shared by the two Handicap tabs and their dialogs.
import type { ReactNode } from 'react';
import { Mail, MessageCircle, type LucideIcon } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Glyph } from '@/components/common/Glyph';
import { waHref } from '../lib/handicap';

export function Pill({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-[5px] text-[11px] font-bold',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
  danger = false,
  disabled = false,
}: {
  icon: LucideIcon;
  /** Read by screen readers and shown on hover: the button has no text. */
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'flex size-8 flex-none cursor-pointer items-center justify-center rounded-full border border-de9-line bg-card text-[14px] disabled:cursor-not-allowed disabled:opacity-40',
        danger ? 'text-de9-red' : 'text-de9-slate',
      )}
    >
      <Glyph icon={icon} />
    </button>
  );
}

/** WhatsApp · e-mail — whichever the row has. The phone number is printed in the row, to read: no call link. */
export function ContactLinks({ phone, email }: { phone?: string | null; email?: string | null }) {
  const t = useT();
  if (!phone && !email) return null;
  const cls =
    'flex size-7 items-center justify-center rounded-full border border-de9-line text-[12.5px] text-de9-slate no-underline';
  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      {phone && (
        <a href={waHref(phone)} target="_blank" rel="noreferrer" aria-label="WhatsApp" title="WhatsApp" className={cls}>
          <Glyph icon={MessageCircle} />
        </a>
      )}
      {email && (
        <a href={'mailto:' + email} aria-label={t('hcEcrire')} title={email} className={cls}>
          <Glyph icon={Mail} />
        </a>
      )}
    </div>
  );
}

/** « Wilaya : Tous » — a filter whose first option clears it. */
export function FilterSelect({
  value,
  label,
  options,
  onChange,
}: {
  value: string;
  label: string;
  options: { v: string; l: string }[];
  onChange: (v: string) => void;
}) {
  const t = useT();
  const all = [{ v: 'all', l: label + ' : ' + t('tous') }, ...options];
  // Radix Select needs the active value to exist as an item, even when the
  // option list no longer contains it (dictionary loading, rows filtered away).
  if (value !== 'all' && !all.some((o) => o.v === value)) all.push({ v: value, l: value });
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-auto w-full cursor-pointer gap-1.5 rounded-xs border border-outline bg-card px-[13px] py-[10px] text-[12.5px] font-semibold text-de9-slate shadow-none sm:w-auto">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {all.map((op) => (
          <SelectItem key={op.v} value={op.v} className="text-[12.5px] font-semibold text-de9-slate">
            {op.l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function RowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="px-5 py-[13px]">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="mb-[13px] h-10 animate-pulse rounded-sm bg-de9-row last:mb-0" />
      ))}
    </div>
  );
}

export function LoadMore({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  const t = useT();
  return (
    <div className="flex justify-center border-t border-de9-line px-5 py-3">
      <button
        type="button"
        disabled={loading}
        onClick={onClick}
        className="cursor-pointer rounded-full border border-de9-line bg-card px-4 py-2 text-[12.5px] font-bold text-de9-slate disabled:cursor-default disabled:opacity-40"
      >
        {loading ? '…' : t('chargerPlus')}
      </button>
    </div>
  );
}

const DIALOG_SIZE = { sm: 'sm:max-w-[440px]', md: 'sm:max-w-[580px]', lg: 'sm:max-w-[760px]' } as const;

/** The dialog chrome every Handicap dialog shares: title, optional lead text, scrollable body. */
export function DialogFrame({
  title,
  lead,
  onClose,
  locked = false,
  size = 'md',
  children,
}: {
  title: ReactNode;
  /** Announced with the title — what the dialog is about to do. */
  lead?: ReactNode;
  onClose: () => void;
  /** A request is running: Escape and the backdrop must not drop it. */
  locked?: boolean;
  size?: keyof typeof DIALOG_SIZE;
  children: ReactNode;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !locked) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        {...(lead ? {} : { 'aria-describedby': undefined })}
        className={cn(
          'block max-h-[90vh] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-xl bg-card p-6 text-de9-ink sm:p-7',
          DIALOG_SIZE[size],
        )}
      >
        <DialogTitle className="text-[19px] leading-normal font-extrabold text-de9-ink">{title}</DialogTitle>
        {lead && (
          <DialogDescription asChild>
            <div className="mt-2.5 text-[13.5px] leading-relaxed text-de9-slate">{lead}</div>
          </DialogDescription>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** « Annuler » + the action, side by side. `cancelLabel` matters when the action itself is called « Annuler ». */
export function DialogActions({
  onCancel,
  cancelLabel,
  submitLabel,
  pending,
  danger = false,
  disabled = false,
  onSubmit,
}: {
  onCancel: () => void;
  cancelLabel?: string;
  submitLabel: string;
  pending: boolean;
  danger?: boolean;
  disabled?: boolean;
  /** Omit inside a <form>: the button then submits it. */
  onSubmit?: () => void;
}) {
  const t = useT();
  return (
    <div className="mt-5 flex gap-2.5">
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="flex-1 cursor-pointer rounded-full border border-de9-line bg-card p-3 text-sm font-bold text-de9-slate disabled:opacity-50"
      >
        {cancelLabel ?? t('annuler')}
      </button>
      <button
        type={onSubmit ? 'button' : 'submit'}
        onClick={onSubmit}
        disabled={pending || disabled}
        className={cn(
          'flex-1 cursor-pointer rounded-full p-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60',
          danger ? 'bg-de9-red text-white' : 'bg-primary text-primary-foreground',
        )}
      >
        {pending ? t('hcEnCours') : submitLabel}
      </button>
    </div>
  );
}

/** A plain yes / no question before something that cannot be undone. */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel,
  danger = true,
  pending,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <DialogFrame title={title} lead={children} onClose={onClose} locked={pending} size="sm">
      <DialogActions
        onCancel={onClose}
        cancelLabel={cancelLabel}
        submitLabel={confirmLabel}
        pending={pending}
        danger={danger}
        onSubmit={onConfirm}
      />
    </DialogFrame>
  );
}

/** A labelled form control with its error (or a hint) underneath. */
export function FormField({
  label,
  required = false,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn('block min-w-0', className)}>
      <span className="mb-1.5 block text-xs font-semibold text-de9-slate">
        {label}
        {required && <span aria-hidden> *</span>}
      </span>
      {children}
      {error ? (
        <span role="alert" className="mt-1 block text-[11.5px] font-semibold text-de9-red">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1 block text-[11.5px] text-de9-gray">{hint}</span>
      ) : null}
    </label>
  );
}
