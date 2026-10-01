import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Direction } from 'radix-ui';
import { Toaster } from '@/components/ui/sonner';
import { dirOf, useLangStore } from '@/stores/langStore';
import { resolveTheme, useThemeStore } from '@/stores/themeStore';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Document-level chrome shared by every route, signed in or not: text
 * direction, language, theme class and the toast host. Lives above the auth
 * boundary so the login screen is themed and RTL-aware like the rest of the app.
 */
export function RootLayout() {
  const lang = useLangStore((s) => s.lang);
  const mode = useThemeStore((s) => s.mode);
  const dir = dirOf(lang);

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [dir, lang]);

  // Track the OS preference, which decides the theme while in "system" mode.
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(DARK_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const onChange = (): void => setSystemDark(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const theme = resolveTheme(mode, systemDark);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    // Radix components (tabs, selects, menus) lay out left-to-right unless told otherwise.
    <Direction.Provider dir={dir}>
      <Outlet />
      {/* The app's own theme and direction — not the OS's. */}
      <Toaster position="bottom-center" theme={theme} dir={dir} />
    </Direction.Provider>
  );
}
