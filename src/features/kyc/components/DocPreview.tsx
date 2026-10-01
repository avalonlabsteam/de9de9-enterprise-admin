// Inline preview of a KYC document — the drawing (image, PDF, or a
// placeholder saying why not) and the large « Agrandir » / « Voir » dialog.
// Fetching and object-URL lifetime live in ../api/preview.
import { useState } from 'react';
import { Download, FileText, Hourglass, X } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Glyph } from '@/components/common/Glyph';
import { useDocPreview, useSaveDocument, type DocPreviewResult } from '../api/preview';

type Renderable = 'image' | 'pdf' | 'other';

/** What the browser can draw: the blob's type first, then the payload's, then the extension. */
function renderableOf(blobType: string, declared: string | null | undefined, fileName: string | null | undefined): Renderable {
  const type = (blobType && blobType !== 'application/octet-stream' ? blobType : declared ?? '').toLowerCase();
  const ext = (fileName ?? '').toLowerCase().split('.').pop() ?? '';
  // HEIC/HEIF only draws in Safari — treat it as a download everywhere.
  if (type.includes('heic') || type.includes('heif') || ext === 'heic' || ext === 'heif') return 'other';
  if (type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image';
  if (type === 'application/pdf' || ext === 'pdf') return 'pdf';
  return 'other';
}

interface PreviewFrameProps extends DocPreviewResult {
  fileName: string | null | undefined;
  contentType: string | null | undefined;
  /** Compact card thumbnail: PDF opens fitted to width, without its toolbar. */
  compact?: boolean;
  className?: string;
}

/** The drawing itself — image, PDF, or a placeholder that says why not. */
export function PreviewFrame({ preview, loading, failed, fileName, contentType, compact, className }: PreviewFrameProps) {
  const t = useT();
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const kind = preview ? renderableOf(preview.contentType, contentType, fileName) : null;
  const broken = !!preview && brokenUrl === preview.url;

  if (preview && kind === 'image' && !broken) {
    return (
      <img
        src={preview.url}
        alt={fileName ?? ''}
        onError={() => setBrokenUrl(preview.url)}
        className={cn('h-full w-full object-contain', className)}
      />
    );
  }
  if (preview && kind === 'pdf') {
    return (
      <iframe
        src={compact ? `${preview.url}#toolbar=0&navpanes=0&view=FitH` : preview.url}
        title={fileName ?? 'PDF'}
        className={cn('h-full w-full bg-white', className)}
      />
    );
  }
  return (
    <div className={cn('flex h-full w-full flex-col items-center justify-center gap-1.5 p-4 text-center', className)}>
      <div className="text-[34px] text-de9-faint">
        <Glyph icon={loading ? Hourglass : FileText} className="stroke-[1.5]" />
      </div>
      <div className="max-w-full truncate text-[12px] font-bold text-de9-slate">{fileName}</div>
      <div className="text-[11px] text-de9-gray">
        {loading ? t('fcApercuChargement') : failed || broken || kind === 'other' ? t('kycApercuTelecharger') : ''}
      </div>
    </div>
  );
}

interface PreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  documentId: string;
  fileName: string | null | undefined;
  contentType: string | null | undefined;
  /** Reuse a preview already on screen instead of downloading the file again. */
  loaded?: DocPreviewResult;
}

/** Large view — « Agrandir » on the current version, « Voir » on an older one. */
export function PreviewDialog({ open, onOpenChange, title, documentId, fileName, contentType, loaded }: PreviewDialogProps) {
  const t = useT();
  const own = useDocPreview(open && !loaded ? documentId : null);
  const shown = loaded ?? own;
  const { save, saving } = useSaveDocument();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex max-h-[94vh] w-full max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden rounded-xl bg-card p-0 text-de9-ink shadow-e3 sm:max-w-[960px]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-de9-line px-4 py-3.5 sm:px-[22px]">
          <div className="min-w-0">
            <DialogTitle className="text-[15px] leading-normal font-extrabold text-de9-ink">{title}</DialogTitle>
            <div className="truncate text-[11.5px] text-de9-gray">{fileName}</div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => save(documentId, fileName)}
              disabled={saving === documentId}
              className="flex cursor-pointer items-center gap-1.5 rounded-full bg-primary px-3.5 py-[9px] text-xs font-bold text-primary-foreground disabled:opacity-50"
            >
              <Glyph icon={Download} /> {saving === documentId ? t('docTelechargementEnCours') : t('telecharger')}
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label={t('fermer')}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-secondary text-base text-de9-slate"
            >
              <Glyph icon={X} />
            </button>
          </div>
        </div>
        <div className="h-[78vh] bg-secondary">
          <PreviewFrame {...shown} fileName={fileName} contentType={contentType} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
