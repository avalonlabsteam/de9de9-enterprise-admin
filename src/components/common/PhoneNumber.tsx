import { Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Glyph } from './Glyph';

/**
 * A phone number, shown to be read or copied — never a `tel:` link: the panel
 * is used at a desk, where a click on one only opens whatever app claims the
 * scheme. Selecting it takes the whole number; « — » when there is none.
 */
export function PhoneNumber({ value, className }: { value: string | null | undefined; className?: string }) {
  return (
    <span className={cn('inline-flex items-center justify-center gap-1.5 whitespace-nowrap', className)}>
      <Glyph icon={Phone} />
      <span className="num select-all">{value || '—'}</span>
    </span>
  );
}
