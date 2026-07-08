import { useLangStore } from '@/stores/langStore';
import { dict, type TKey } from './dict';

export type { TKey };

/** Reactive translator — re-renders the consumer when the language changes. */
export function useT(): (key: TKey) => string {
  const lang = useLangStore((s) => s.lang);
  return (key: TKey) => dict[lang][key];
}

/** Non-reactive translator for use outside React (mock handlers, toasts). */
export function t(key: TKey): string {
  return dict[useLangStore.getState().lang][key];
}

/** Inline bilingual value for one-off strings that don't warrant a dict key. */
export function useL(): (frText: string, arText: string) => string {
  const lang = useLangStore((s) => s.lang);
  return (frText: string, arText: string) => (lang === 'ar' ? arText : frText);
}
