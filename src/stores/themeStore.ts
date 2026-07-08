import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
}

export const useThemeStore = create<ThemeState>()(
  persist(() => ({ mode: 'system' as ThemeMode }), { name: 'de9de9-theme' }),
);

export const themeActions = {
  set: (mode: ThemeMode): void => {
    useThemeStore.setState({ mode });
  },
  /** light → dark → system → light */
  cycle: (): void => {
    useThemeStore.setState((s) => ({
      mode: s.mode === 'light' ? 'dark' : s.mode === 'dark' ? 'system' : 'light',
    }));
  },
};

export function resolveTheme(mode: ThemeMode, systemDark: boolean): 'light' | 'dark' {
  return mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;
}
