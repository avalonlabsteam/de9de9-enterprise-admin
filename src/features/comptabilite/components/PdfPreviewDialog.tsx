import { useState } from 'react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';
import { downloadFromApi } from '@/api/documents';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { PreviewFrame } from '@/features/kyc/components/DocPreview';
import { useApiPreview } from '../api/comptabilite';

export interface PdfPreview {
  title: string;
  /** apiClient path (no /api prefix), e.g. /comptabilite/paiements/{id}/recu. */
  url: string;
  /** Used only when the answer carries no Content-Disposition filename. */
  fileName: string;
}

/**
 * « Aperçu » of a PDF route — our receipt, the BILAN. The file needs the Bearer
 * header, so it is fetched as a blob (`?inline=true`) and drawn from an object
 * URL; « Télécharger » saves it under the server's file name.
 */
export function PdfPreviewDialog({ preview, onClose }: { preview: PdfPreview; onClose: () => void }) {
  const t = useT();
  const shown = useApiPreview(preview.url, preview.fileName, t('docTelechargementErreur'));
  const [saving, setSaving] = useState(false);

  const onDownload = (): void => {
    setSaving(true);
    downloadFromApi(preview.url, { fallbackName: preview.fileName, fallbackMessage: t('docTelechargementErreur') })
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : t('docTelechargementErreur')))
      .finally(() => setSaving(false));
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex max-h-[94vh] w-full max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden rounded-[20px] bg-card p-0 text-de9-ink shadow-[0_30px_70px_rgba(20,30,45,.4)] sm:max-w-[960px]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-de9-line px-4 py-3.5 sm:px-[22px]">
          <DialogTitle className="min-w-0 truncate text-[15px] leading-normal font-extrabold text-de9-ink">
            {preview.title}
          </DialogTitle>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onDownload}
              disabled={saving || !!shown.error}
              className="flex cursor-pointer items-center gap-1.5 rounded-[10px] bg-de9-ink px-3.5 py-[9px] text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:text-[#151923]"
            >
              ⤓ {saving ? t('docTelechargementEnCours') : t('telecharger')}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('fermer')}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] bg-secondary text-base text-de9-slate"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="h-[78vh] bg-secondary">
          {shown.error ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-[13px] font-semibold text-de9-red">
              {shown.error}
            </div>
          ) : (
            <PreviewFrame
              preview={shown.url ? { url: shown.url, contentType: shown.contentType } : null}
              loading={shown.loading}
              failed={false}
              fileName={preview.fileName}
              contentType="application/pdf"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
