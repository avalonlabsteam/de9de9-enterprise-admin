// Small pieces shared by the queue and the annonce page: the pills (status,
// B2C publication, « Modifiée », « Reprise de fiche ») and the cover.
import { useState, type ReactNode } from 'react';
import { ImageOff, PenLine } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Glyph } from '@/components/common/Glyph';
import { fmtAlger } from '@/features/comptabilite/lib/comptabilite';
import { tonChip } from '../lib/annonces';
import type { Tag } from '../schemas/annonces';

/**
 * A sentence with a `{date}`: the date and time stay one left-to-right run in
 * the Arabic UI, as in the lists (`.num`), instead of the time jumping first.
 */
export function Dated({ text, iso }: { text: string; iso: string | null | undefined }) {
  const [before, after = ''] = text.split('{date}');
  return (
    <>
      {before}
      <span className="num">{fmtAlger(iso) ?? '—'}</span>
      {after}
    </>
  );
}

const PILL = 'inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-[4px] text-[11px] font-bold';

export function Pill({ className, children, title }: { className: string; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={cn(PILL, className)}>
      {children}
    </span>
  );
}

/** The server's status, coloured by its tone. */
export function TagPill({ tag }: { tag: Tag }) {
  return <Pill className={tonChip(tag.ton)}>{tag.label}</Pill>;
}

/** Status + the B2C publication state + « Modifiée » + « Reprise de fiche ». */
export function StatutPills({
  statut,
  publication,
  modifiee,
  reprise,
}: {
  statut: Tag;
  publication?: Tag | null;
  modifiee: boolean;
  reprise: boolean;
}) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <TagPill tag={statut} />
      {publication && <TagPill tag={publication} />}
      {modifiee && (
        <Pill className="border border-[#E6C77E] bg-card text-[#B68A2E] dark:border-[#B68A2E]/60 dark:text-[#D9B36A]">
          <Glyph icon={PenLine} /> {t('annModifiee')}
        </Pill>
      )}
      {reprise && <Pill className="border border-de9-line bg-card text-de9-gray">{t('annRepriseFiche')}</Pill>}
    </div>
  );
}

/** A plain <img>: the photo URLs are absolute and need no token. A neutral tile when there is none. */
export function Cover({ url, className }: { url: string | null | undefined; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} className={cn('flex-none rounded-md object-cover', className)} />;
  }
  return (
    <div className={cn('flex flex-none items-center justify-center rounded-md bg-secondary text-de9-faint', className)}>
      <ImageOff className="size-[45%]" strokeWidth={1.5} />
    </div>
  );
}
