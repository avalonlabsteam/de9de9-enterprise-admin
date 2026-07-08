import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Lang = 'fr' | 'ar';
export type Dir = 'ltr' | 'rtl';

interface LangState {
  lang: Lang;
}

export const useLangStore = create<LangState>()(
  persist(() => ({ lang: 'fr' as Lang }), { name: 'de9de9-lang' }),
);

export const langActions = {
  set: (lang: Lang): void => {
    useLangStore.setState({ lang });
  },
  toggle: (): void => {
    useLangStore.setState((s) => ({ lang: s.lang === 'fr' ? 'ar' : 'fr' }));
  },
};

export const dirOf = (lang: Lang): Dir => (lang === 'ar' ? 'rtl' : 'ltr');
