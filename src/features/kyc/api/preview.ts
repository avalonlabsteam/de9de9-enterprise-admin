// KYC files: inline preview and download. The file links need the Bearer
// header, so a bare <img>/<iframe src> would get a 401 — the file is fetched
// as a blob through apiClient (`?inline=true`) and shown from an object URL.
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';
import { previewDocument, useDownloadDocument } from '@/api/documents';

export interface LoadedPreview {
  url: string;
  contentType: string;
}

export interface DocPreviewResult {
  preview: LoadedPreview | null;
  loading: boolean;
  failed: boolean;
}

interface PreviewState {
  forId: string;
  /** Null when the fetch failed. */
  preview: LoadedPreview | null;
}

/**
 * Fetch `documentId` for preview; null fetches nothing. The object URL holds
 * the whole file in memory, so it is revoked as soon as the id changes or the
 * caller unmounts.
 */
export function useDocPreview(documentId: string | null): DocPreviewResult {
  const [state, setState] = useState<PreviewState | null>(null);

  useEffect(() => {
    if (!documentId) return;
    let cancelled = false;
    let url: string | null = null;
    previewDocument(documentId)
      .then((res) => {
        if (cancelled) {
          URL.revokeObjectURL(res.url);
          return;
        }
        url = res.url;
        setState({ forId: documentId, preview: { url: res.url, contentType: res.contentType } });
      })
      .catch(() => {
        if (!cancelled) setState({ forId: documentId, preview: null });
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      // Never render a revoked URL if the same id comes back later.
      setState((s) => (s?.forId === documentId ? null : s));
    };
  }, [documentId]);

  const current = state && state.forId === documentId ? state : null;
  return {
    preview: current?.preview ?? null,
    loading: !!documentId && !current,
    failed: !!current && !current.preview,
  };
}

/** Save a stored document; the toast carries the server's reason on failure. */
export function useSaveDocument() {
  const t = useT();
  const download = useDownloadDocument();
  const save = (documentId: string, fileName: string | null | undefined): void => {
    download.mutate(
      { id: documentId, fileName: fileName ?? undefined, fallbackMessage: t('docTelechargementErreur') },
      { onError: (err) => toast.error(err.message) },
    );
  };
  /** The id being saved, to disable its button. */
  const saving = download.isPending ? (download.variables?.id ?? null) : null;
  return { save, saving };
}
