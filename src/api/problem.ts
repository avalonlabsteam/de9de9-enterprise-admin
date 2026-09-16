import axios from 'axios';
import { problemDetailsSchema } from '@/features/auth/schemas/auth';

/**
 * A readable message for a failed apiClient call, in order of preference: the
 * server's RFC 7807 `detail`; the messages of an ASP.NET validation response
 * (`errors: { field: [msg] }`); the caller's localized `fallback` for the status;
 * axios' own message. `title` is skipped — it is the generic English reason
 * phrase.
 */
export function problemMessage(
  err: unknown,
  fallback?: (status: number | undefined) => string | undefined,
): string {
  if (axios.isAxiosError(err)) {
    const parsed = problemDetailsSchema.safeParse(err.response?.data);
    const problem = parsed.success ? parsed.data : undefined;
    const errors =
      problem && typeof problem.errors === 'object' && problem.errors !== null
        ? Object.values(problem.errors as Record<string, unknown>)
            .flat()
            .filter((m): m is string => typeof m === 'string')
        : [];
    return (
      problem?.detail ??
      (errors.length ? errors.join(' · ') : undefined) ??
      fallback?.(err.response?.status) ??
      err.message
    );
  }
  return err instanceof Error ? err.message : String(err);
}
