// V4 → V5 « Déposer la facture » for a live visit: POST
// /commandes/worklist/{id}/deposer-facture uploads the invoice itself
// (multipart `files`), with the amount and note as the JSON `payload`.
// The amount is mandatory at this step: nothing is sent without it.
// ActionModals' DepositModal stays as it is — the mock console only records a
// file name. Visual ground truth: src/admin/views/Console.tsx modals.
import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Paperclip, ReceiptText, Upload, X } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Glyph } from '@/components/common/Glyph';

interface DepositInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  /** The amount always goes — a whole number of credits above zero; `note` is left out when empty. */
  onConfirm: (values: { files: File[]; montantCredits: number; note?: string }) => void;
}

const LABEL_CLASS = 'mb-1.5 block text-xs font-semibold text-de9-slate';
const INPUT_CLASS =
  'h-auto w-full rounded-xs border border-outline bg-card px-3.5 py-3 text-[14px] text-de9-ink shadow-none outline-none';

/** The typed amount as credits — a whole number above zero — or null while it is not one. */
function parseMontant(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  const amount = Number(text);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export function DepositInvoiceModal({ open, onOpenChange, pending, onConfirm }: DepositInvoiceModalProps) {
  const t = useT();
  const [files, setFiles] = useState<File[]>([]);
  const [montant, setMontant] = useState('');
  const [note, setNote] = useState('');
  // The amount's error waits for a refused « Déposer » or for a typed value that
  // is not an amount: the dialog opens with the cursor in this field, and merely
  // leaving it to pick the file must not turn it red.
  const [montantChecked, setMontantChecked] = useState(false);
  const montantRef = useRef<HTMLInputElement>(null);
  const amount = parseMontant(montant);
  const montantError = montantChecked && amount === null;

  const pickFiles = (e: ChangeEvent<HTMLInputElement>): void => {
    // Copied now, not inside the updater: clearing the input empties this very
    // FileList, and React often runs the updater only after that — a file picked
    // after typing in the form was then silently dropped.
    const picked = Array.from(e.target.files ?? []);
    if (picked.length) setFiles((fs) => [...fs, ...picked]);
    e.target.value = '';
  };

  const submit = (): void => {
    if (amount === null) {
      setMontantChecked(true);
      montantRef.current?.focus();
      return;
    }
    onConfirm({
      files,
      montantCredits: amount,
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="block max-h-[90vh] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-xl bg-card p-[26px] shadow-e3 ring-0 sm:max-w-[460px]"
      >
        <div className="flex size-[54px] items-center justify-center rounded-md bg-[#F4EFFB] text-[26px] dark:bg-[#7C57C7]/15 text-[#7C57C7] dark:text-[#A98BE8]">
          <Glyph icon={ReceiptText} />
        </div>
        <DialogTitle className="mt-4 text-[19px] font-extrabold leading-normal text-de9-ink">
          {t('titleDeposit')}
        </DialogTitle>
        <div className="mt-[9px] text-[13px] leading-[1.55] text-de9-slate">{t('depositInfo')}</div>

        <div className="mt-4">
          <div className={LABEL_CLASS}>
            {t('fileLabel')}
            <span aria-hidden> *</span>
          </div>
          <div className="flex flex-wrap items-center gap-[9px]">
            {files.map((file, i) => (
              <div
                key={file.name + i}
                className="flex items-center gap-[7px] rounded-sm border border-de9-line bg-card px-[11px] py-2"
              >
                <span className="text-[15px]"><Glyph icon={Paperclip} /></span>
                <span className="max-w-[160px] truncate text-[12px] font-semibold text-de9-slate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setFiles((fs) => fs.filter((_, k) => k !== i))}
                  className="cursor-pointer text-[13px] text-de9-faint"
                >
                  <Glyph icon={X} />
                </button>
              </div>
            ))}
            {/* The upload control: a real button that opens the file picker. */}
            <label className="flex cursor-pointer items-center gap-2 rounded-sm bg-[#7C57C7] px-4 py-2.5 text-[12.5px] font-bold text-white">
              <span className="text-[15px]"><Glyph icon={Upload} /></span>
              {files.length ? t('joindreDoc') : t('choisirFichier')}
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={pickFiles}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="mt-3.5">
          <label htmlFor="deposit-montant" className={LABEL_CLASS}>
            {t('montantLabel')}
            <span aria-hidden> *</span>
          </label>
          <Input
            ref={montantRef}
            id="deposit-montant"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            required
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            onBlur={() => {
              if (montant.trim()) setMontantChecked(true);
            }}
            aria-invalid={montantError}
            aria-describedby={montantError ? 'deposit-montant-error' : undefined}
            className={INPUT_CLASS}
          />
          {montantError && (
            <div id="deposit-montant-error" role="alert" className="mt-1.5 text-[11.5px] font-semibold text-de9-red">
              {t('depositMontantRequis')}
            </div>
          )}
        </div>

        <div className="mt-3.5">
          <label htmlFor="deposit-note" className={LABEL_CLASS}>
            {t('noteLabel')}
          </label>
          <Input
            id="deposit-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('optionnel')}
            className={INPUT_CLASS}
          />
        </div>

        <div className="mt-[22px] flex gap-[11px]">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-auto flex-1 rounded-full bg-secondary p-3.5 text-center text-sm font-bold text-de9-slate hover:bg-secondary"
          >
            {t('annuler')}
          </Button>
          <Button
            type="button"
            disabled={pending || files.length === 0}
            onClick={submit}
            className="h-auto flex-1 rounded-full bg-[#7C57C7] p-3.5 text-center text-sm font-bold text-white hover:bg-[#6C49B5] disabled:opacity-70"
          >
            {t('btnDeposit')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
