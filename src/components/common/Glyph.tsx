import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GlyphProps {
  icon: LucideIcon;
  className?: string;
  /** Solid instead of outlined — a filled star, a status dot. */
  filled?: boolean;
}

/**
 * An icon set in running text. It takes the size and colour of the text around
 * it and sits on the baseline like a character, so it reads the same in a
 * label, a chip, a button or a 48px placeholder.
 */
export function Glyph({ icon: Icon, className, filled = false }: GlyphProps) {
  return (
    <Icon
      aria-hidden
      className={cn('inline-block size-[1.15em] flex-none align-[-0.2em]', filled && 'fill-current', className)}
    />
  );
}
