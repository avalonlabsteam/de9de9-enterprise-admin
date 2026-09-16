// V4 → V5 « Déposer la facture » for a live visit: POST
// /commandes/worklist/{id}/deposer-facture uploads the invoice itself
// (multipart `files`), with the amount and note as the JSON `payload`.
// ActionModals' DepositModal stays as it is — the mock console only records a
// file name. Visual ground truth: src/admin/views/Console.tsx modals.
import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface DepositInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  /** `montantCredits` / `note` are left out when the fields are empty — the payload part is optional. */
  onConfirm: (values: { files: File[]; montantCredits?: number; note?: string }) => void;
}

const LABEL_CLASS = 'mb-1.5 text-xs font-semibold text-de9-slate';
const INPUT_CLASS =
  'h-auto w-full rounded-xl border-[1.5px] border-de9-line bg-card px-3.5 py-3 text-[14px] text-de9-ink shadow-none outline-none';

export function DepositInvoiceModal({ open, onOpenChange, pending, onConfirm }: DepositInvoiceModalProps) {
  const t = useT();
  const [files, setFiles] = useState<File[]>([]);
  const [montant, setMontant] = useState('');
  const [note, setNote] = useState('');

  const pickFiles = (e: ChangeEvent<HTMLInputElement>): void => {
    const picked = e.target.files;
    if (picked && picked.length) setFiles((fs) => [...fs, ...picked]);
    e.target.value = '';
  };

  const submit = (): void => {
    const amount = Number(montant);
    onConfirm({
      files,
      ...(montant.trim() && Number.isFinite(amount) ? { montantCredits: amount } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="block max-h-[90vh] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-[22px] bg-card p-[26px] shadow-[0_30px_70px_rgba(20,30,45,.4)] ring-0 sm:max-w-[460px]"
      >
        <div className="flex size-[54px] items-center justify-center rounded-[15px] bg-[#F4EFFB] text-[26px] dark:bg-[#7C57C7]/15">
          🧾
        </div>
        <DialogTitle className="mt-4 text-[19px] font-extrabold leading-normal text-de9-ink">
          {t('titleDeposit')}
        </DialogTitle>
        <div className="mt-[9px] text-[13px] leading-[1.55] text-de9-slate">{t('depositInfo')}</div>

        <div className="mt-4">
          <div className={LABEL_CLASS}>{t('fileLabel')}</div>
          <div className="flex flex-wrap items-center gap-[9px]">
            {files.map((file, i) => (
              <div
                key={file.name + i}
                className="flex items-center gap-[7px] rounded-[10px] border-[1.5px] border-de9-line bg-card px-[11px] py-2"
              >
                <span className="text-[15px]">📎</span>
                <span className="max-w-[160px] truncate text-[12px] font-semibold text-de9-slate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setFiles((fs) => fs.filter((_, k) => k !== i))}
                  className="cursor-pointer text-[13px] text-[#C0C8D0]"
                >
                  ✕
                </button>
              </div>
            ))}
            {/* The upload control: a real button that opens the file picker. */}
            <label className="flex cursor-pointer items-center gap-2 rounded-[11px] bg-[#7C57C7] px-4 py-2.5 text-[12.5px] font-bold text-white shadow-[0_8px_18px_rgba(124,87,199,.35)]">
              <span className="text-[15px]">⤒</span>
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
          <div className={LABEL_CLASS}>{t('montantLabel')}</div>
          <Input
            type="number"
            min={0}
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            placeholder={t('optionnel')}
            className={INPUT_CLASS}
          />
        </div>

        <div className="mt-3.5">
          <div className={LABEL_CLASS}>{t('noteLabel')}</div>
          <Input
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
            className="h-auto flex-1 rounded-[13px] bg-secondary p-3.5 text-center text-sm font-bold text-de9-slate hover:bg-secondary"
          >
            {t('annuler')}
          </Button>
          <Button
            type="button"
            disabled={pending || files.length === 0}
            onClick={submit}
            className="h-auto flex-1 rounded-[13px] bg-[#7C57C7] p-3.5 text-center text-sm font-bold text-white shadow-[0_10px_22px_rgba(124,87,199,.38)] hover:bg-[#6C49B5] disabled:opacity-70"
          >
            {t('btnDeposit')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
