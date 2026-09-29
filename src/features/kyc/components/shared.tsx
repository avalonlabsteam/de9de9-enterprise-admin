// Small presentational pieces shared by the queue and the review screen.
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { KycProgression } from '../schemas/kyc';
import { TONES, type Tone } from '../lib/kyc';

export function StatusPill({ tone, label, className }: { tone: Tone; label: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[5px] text-[11px] font-bold',
        tone.chip,
        className,
      )}
    >
      <span className={cn('h-[7px] w-[7px] flex-none rounded-full', tone.dot)} />
      {label}
    </span>
  );
}

const TAG_TONE = {
  blue: 'border-[#BFD9F2] text-[#2F7FD0] dark:border-[#2F7FD0]/40 dark:text-[#7EB5EC]',
  amber: 'border-[#F0E2C0] text-[#B68A2E] dark:border-[#B68A2E]/40 dark:text-[#D9B36A]',
  grey: 'border-de9-line text-de9-gray',
} as const;

/** « Revue en cours » / « ↻ Renvoyé » — outlined, so it reads apart from the status pill. */
export function Tag({ children, tone = 'blue' }: { children: ReactNode; tone?: keyof typeof TAG_TONE }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full border px-2 py-[3px] text-[10.5px] font-extrabold',
        TAG_TONE[tone],
      )}
    >
      {children}
    </span>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('text-[10.5px] font-extrabold uppercase tracking-[.04em] text-de9-gray', className)}>
      {children}
    </div>
  );
}

/**
 * Stacked bar: validated, refused, to check — the rest of `total` (missing
 * pieces) stays empty track. Flex proportions, so the gaps never overflow.
 */
export function ProgressBar({ progression, className }: { progression: KycProgression; className?: string }) {
  const { valides, refuses, aVerifier, total } = progression;
  const segments: { n: number; cls: string }[] = [
    { n: valides, cls: TONES.green.bar },
    { n: refuses, cls: TONES.red.bar },
    { n: aVerifier, cls: TONES.blue.bar },
    { n: Math.max(total - valides - refuses - aVerifier, 0), cls: 'bg-transparent' },
  ];
  return (
    <div
      role="img"
      aria-label={progression.libelle ?? `${valides} / ${total}`}
      className={cn('flex h-2 w-full gap-[3px] overflow-hidden rounded-full bg-secondary', className)}
    >
      {segments
        .filter((s) => s.n > 0)
        .map((s, i) => (
          <div key={i} className={cn('h-full basis-0', s.cls)} style={{ flexGrow: s.n }} />
        ))}
    </div>
  );
}
