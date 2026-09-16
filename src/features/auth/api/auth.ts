import axios from 'axios';
import { useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { attachHttpLogger } from '@/api/httpLogger';
import { authActions, useAuthStore } from '@/stores/authStore';
import {
  loginResponseSchema,
  problemDetailsSchema,
  type LoginInput,
  type LoginResponse,
} from '../schemas/auth';

/**
 * Auth talks to the real API, so it gets its own axios instance:
 *  - no mock adapter (apiClient still serves the rest of the app from `src/api/mock`)
 *  - no 401 interceptor — a rejected login is a form error, not a session expiry
 *
 * The default base URL is the *relative* `/auth-api`, which the Vite dev server
 * proxies to the real host (see vite.config.ts). Going direct from the browser
 * fails: the API answers preflight with 204 but sends no
 * `Access-Control-Allow-Origin`, so the browser blocks the response. Point
 * VITE_AUTH_API_URL at the absolute URL once CORS allows this origin.
 */
export const authClient = axios.create({
  baseURL: import.meta.env.VITE_AUTH_API_URL ?? '/auth-api',
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

// Credentials and tokens are masked by the logger before anything is printed.
attachHttpLogger(authClient);

/** Machine-readable reason, so the UI can localize instead of echoing English. */
export type AuthFailureKind = 'credentials' | 'network' | 'server';

export interface AuthFailure {
  kind: AuthFailureKind;
  /** `code` from the problem body, e.g. 'invalid_credentials'. */
  code: string | null;
  /** Correlation id to quote in a support request. */
  traceId: string | null;
}

export class AuthError extends Error {
  readonly failure: AuthFailure;
  constructor(failure: AuthFailure) {
    super(`${failure.kind}${failure.code ? `:${failure.code}` : ''}`);
    this.name = 'AuthError';
    this.failure = failure;
  }
}

function toAuthError(err: unknown): AuthError {
  if (!axios.isAxiosError(err)) {
    return new AuthError({ kind: 'server', code: null, traceId: null });
  }
  // No response at all — offline, DNS, timeout, or a CORS-blocked response.
  if (!err.response) return new AuthError({ kind: 'network', code: null, traceId: null });

  const { status, data } = err.response;
  const parsed = problemDetailsSchema.safeParse(data);
  const code = parsed.success ? (parsed.data.code ?? null) : null;
  const traceId = parsed.success ? (parsed.data.traceId ?? null) : null;
  const kind: AuthFailureKind = status === 401 || status === 400 ? 'credentials' : 'server';

  return new AuthError({ kind, code, traceId });
}

/**
 * POST /auth/login — on success the session is written to the auth store and the
 * query cache is cleared so no data from a previous user survives the switch.
 */
export function useLogin() {
  return useMutation<LoginResponse, AuthError, LoginInput>({
    mutationFn: async (input) => {
      let data: unknown;
      try {
        const res = await authClient.post('/auth/login', input);
        data = res.data;
      } catch (err) {
        throw toAuthError(err);
      }
      // Parsed outside the catch so a contract mismatch is not mistaken for a
      // transport failure.
      const parsed = loginResponseSchema.safeParse(data);
      if (!parsed.success) {
        throw new AuthError({ kind: 'server', code: 'malformed_response', traceId: null });
      }
      return parsed.data;
    },
    onSuccess: (session) => {
      queryClient.clear();
      authActions.setSession(session);
    },
  });
}

/**
 * POST /auth/refresh — trades the stored refresh token for a new session and
 * writes it to the auth store. Resolves with the new access token.
 *
 * Single-flight: concurrent 401s (a page firing several queries at once) share
 * one in-flight refresh instead of racing the same refresh token, which may be
 * single-use server-side. Only a *credentials* failure clears the session — a
 * network blip or a 5xx should not kick the user out.
 */
let refreshInFlight: Promise<string> | null = null;

export function refreshSession(): Promise<string> {
  refreshInFlight ??= doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function doRefresh(): Promise<string> {
  const { refreshToken, refreshTokenExpiresAt } = useAuthStore.getState();

  if (!refreshToken) {
    logout();
    throw new AuthError({ kind: 'credentials', code: 'no_refresh_token', traceId: null });
  }
  const expiry = refreshTokenExpiresAt ? Date.parse(refreshTokenExpiresAt) : Number.NaN;
  if (!Number.isNaN(expiry) && expiry <= Date.now()) {
    logout();
    throw new AuthError({ kind: 'credentials', code: 'refresh_token_expired', traceId: null });
  }

  let data: unknown;
  try {
    const res = await authClient.post('/auth/refresh', { refreshToken });
    data = res.data;
  } catch (err) {
    const authError = toAuthError(err);
    if (authError.failure.kind === 'credentials') logout();
    throw authError;
  }

  // Same contract as login (verified against the swagger example).
  const parsed = loginResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new AuthError({ kind: 'server', code: 'malformed_response', traceId: null });
  }
  authActions.setSession(parsed.data);
  return parsed.data.accessToken;
}

/**
 * Clears the session and every cached query.
 *
 * The API likely exposes a revoke/logout route, but it is not in the portion of
 * the swagger that was shared and the spec itself is behind auth, so this stays
 * local-only. Add the POST here once the endpoint is confirmed — the refresh
 * token is already persisted for exactly that.
 */
export function logout(): void {
  authActions.logout();
  queryClient.clear();
}
