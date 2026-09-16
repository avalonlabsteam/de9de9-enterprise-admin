import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser, LoginResponse } from '@/features/auth/schemas/auth';

export type { AuthUser };

interface AuthState {
  accessToken: string | null;
  accessTokenExpiresAt: string | null;
  refreshToken: string | null;
  refreshTokenExpiresAt: string | null;
  user: AuthUser | null;
}

const emptySession: AuthState = {
  accessToken: null,
  accessTokenExpiresAt: null,
  refreshToken: null,
  refreshTokenExpiresAt: null,
  user: null,
};

export const useAuthStore = create<AuthState>()(
  persist(() => emptySession, {
    name: 'de9de9-auth',
    // v1 stored a hardcoded `{ token, user }` mock session. Drop anything older
    // than v2 rather than trying to reshape it — it was never a real session.
    version: 2,
    migrate: () => emptySession,
  }),
);

/** Actions are decoupled from the hook so non-React code (interceptors, handlers) can call them. */
export const authActions = {
  setSession: (session: LoginResponse): void => {
    useAuthStore.setState({
      accessToken: session.accessToken,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      refreshToken: session.refreshToken,
      refreshTokenExpiresAt: session.refreshTokenExpiresAt,
      user: session.user,
    });
  },
  logout: (): void => {
    useAuthStore.setState(emptySession);
  },
};

/** True while the stored access token exists and has not passed its expiry. */
export function isSessionValid(state: AuthState): boolean {
  if (!state.accessToken) return false;
  if (!state.accessTokenExpiresAt) return true; // no expiry given — trust the token
  const expiry = Date.parse(state.accessTokenExpiresAt);
  return Number.isNaN(expiry) ? true : expiry > Date.now();
}

/** Reactive guard for components. */
export const useIsAuthenticated = (): boolean => useAuthStore(isSessionValid);
