// Document download — GET {VITE_API_URL}/documents/{id}/download
//
// The API already hands us this route: every document in a payload carries
// `url: "https://…/api/v1/documents/<id>/download"` alongside its id. We never
// use that absolute URL directly, for two reasons:
//   - the API sends no CORS headers for this origin (hence the dev proxy), and
//   - a plain <a href> or window.open cannot attach the bearer token.
// So the file is fetched as a blob through apiClient — which adds the token and
// replays after a refresh on 401 — and saved from memory.
import axios from 'axios';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { problemMessage } from '@/api/problem';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * The document id from either a bare id or a download URL, or null when the
 * value is neither. Callers hold a mix: `documentId` fields, `url` fields, and
 * placeholders like 'KycRc' that `kycView` substitutes when a piece was never
 * uploaded — those must read as « nothing to download », not as an id.
 */
export function documentIdFrom(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = UUID_RE.exec(value);
  return match ? match[0] : null;
}

/** Content-Disposition filename, preferring the RFC 5987 `filename*` form. */
function filenameFrom(disposition: unknown, fallback: string): string {
  if (typeof disposition !== 'string') return fallback;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1]);
    } catch {
      // Malformed percent-encoding — fall through to the plain form.
    }
  }
  return /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? fallback;
}

/**
 * An error response to a blob request arrives as a Blob, not JSON, so the RFC
 * 7807 `detail` is invisible to problemMessage until the body is read back.
 */
async function messageFor(err: unknown, fallback: string): Promise<string> {
  if (axios.isAxiosError(err) && err.response?.data instanceof Blob) {
    try {
      const parsed: unknown = JSON.parse(await err.response.data.text());
      if (parsed && typeof parsed === 'object' && 'detail' in parsed) {
        const detail = (parsed as { detail: unknown }).detail;
        if (typeof detail === 'string' && detail) return detail;
      }
    } catch {
      // Not JSON (an HTML error page, or an empty body) — use the fallback.
    }
  }
  return problemMessage(err, () => fallback);
}

/**
 * Fetch one document and hand it to the browser to save. Rejects with an Error
 * whose message is already readable, so callers can toast `err.message`.
 */
export async function downloadDocument(id: string, fileName?: string, fallbackMessage?: string): Promise<void> {
  let res;
  try {
    res = await apiClient.get(`/documents/${encodeURIComponent(id)}/download`, {
      responseType: 'blob',
      // A scanned PDF over a slow link outlives the 15s default.
      timeout: 120_000,
    });
  } catch (err) {
    // Rethrown with a readable message, keeping the original as `cause` so the
    // axios error (status, response) survives for anyone inspecting it.
    throw new Error(await messageFor(err, fallbackMessage ?? 'Téléchargement impossible'), { cause: err });
  }

  const name = filenameFrom(res.headers?.['content-disposition'], fileName || 'document');
  const href = URL.createObjectURL(res.data as Blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the save in Safari — let the click settle.
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

export interface DownloadDocumentInput {
  /** A document id or a `/documents/{id}/download` URL. */
  id: string;
  /** Used only when the response carries no Content-Disposition filename. */
  fileName?: string;
  /** Localized message for a failure the server did not explain. */
  fallbackMessage?: string;
}

/** Mutation wrapper, for `isPending` on the button that triggered it. */
export function useDownloadDocument() {
  return useMutation({
    mutationFn: async ({ id, fileName, fallbackMessage }: DownloadDocumentInput): Promise<void> => {
      const documentId = documentIdFrom(id);
      if (!documentId) throw new Error(fallbackMessage ?? 'Document indisponible');
      await downloadDocument(documentId, fileName, fallbackMessage);
    },
  });
}
