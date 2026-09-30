import { createElement } from 'react';
import { iconOf } from '../lib/alertes';

/** The lucide icon for an `icone` token (guide 11 §1.4); unknown tokens get the bell. */
export function AlerteIcon({ icone, className }: { icone: string | null | undefined; className?: string }) {
  return createElement(iconOf(icone), { className });
}
