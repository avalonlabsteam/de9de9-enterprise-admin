import axios, { type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/authStore';
import { logout, refreshSession } from '@/features/auth/api/auth';
import { mockAdapter } from '@/api/mock';
import { attachHttpLogger } from '@/api/httpLogger';

const useMock = import.meta.env.VITE_API_MOCK !== 'false';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 15_000,
  ...(useMock ? { adapter: mockAdapter } : {}),
});

// First, so its response interceptor logs each exchange as received (a 401 is
// logged before the refresh interceptor below retries it).
attachHttpLogger(apiClient);

// Pull the token from the store at request time (never from a captured closure).
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

/** Marks a request already replayed after a refresh, so a second 401 can't loop. */
interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const config = error.config as RetriableConfig | undefined;
      if (config && !config._retry) {
        config._retry = true;
        try {
          await refreshSession();
          // Replay the original request; the request interceptor re-runs and
          // attaches the fresh token from the store.
          return apiClient(config);
        } catch {
          // refreshSession already cleared the session when the refresh token
          // was rejected; surface the original 401 to the caller either way.
        }
      } else {
        // Still 401 after a successful refresh — the session is unusable.
        logout();
      }
    }
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  },
);
