import axios from 'axios';
import { authActions, useAuthStore } from '@/stores/authStore';
import { mockAdapter } from '@/api/mock';

const useMock = import.meta.env.VITE_API_MOCK !== 'false';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 15_000,
  ...(useMock ? { adapter: mockAdapter } : {}),
});

// Pull the token from the store at request time (never from a captured closure).
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      authActions.logout();
    }
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  },
);
