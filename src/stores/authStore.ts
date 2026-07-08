import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  name: string;
  role: 'admin';
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
}

const initialState: AuthState = {
  token: 'mock-admin-token',
  user: { id: 'admin-1', name: 'De9De9 Admin', role: 'admin' },
};

export const useAuthStore = create<AuthState>()(
  persist(() => initialState, { name: 'de9de9-auth' }),
);

/** Actions are decoupled from the hook so non-React code (interceptors, handlers) can call them. */
export const authActions = {
  login: (token: string, user: AuthUser): void => {
    useAuthStore.setState({ token, user });
  },
  logout: (): void => {
    useAuthStore.setState({ token: null, user: null });
  },
};
