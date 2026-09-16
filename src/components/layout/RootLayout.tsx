import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { dirOf, useLangStore } from '@/stores/langStore';
import { resolveTheme, useThemeStore } from '@/stores/themeStore';

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

  // Apply the theme class; track OS preference while in "system" mode.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.classList.toggle(
        'dark',
        resolveTheme(mode, media.matches) === 'dark',
      );
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [mode]);

  return (
    <>
      <Outlet />
      <Toaster position="bottom-center" />
    </>
  );
}
