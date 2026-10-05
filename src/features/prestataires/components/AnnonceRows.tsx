// A company's published B2B annonces, as the search card (three at most) and
// the profile's « Annonces » tab draw them: the cover — else the category's
// icon —, the title that opens the annonce in the panel, `tarif · zones`, the
// start delay, and the row's own « Demander un devis ». Every label is the
// server's, ready to print.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { taxoOf } from '@/features/annonces/lib/annonces';
import type { AnnonceCarte } from '../schemas/recherche';
import { CategoryIcon } from './CategoryIcon';

const TILE = 'flex size-11 flex-none items-center justify-center rounded-md bg-secondary';

/** A plain <img>: the cover URL is absolute and public. Without one — or when it fails — the category's icon. */
function AnnonceCover({ annonce: a }: { annonce: AnnonceCarte }) {
  const [failed, setFailed] = useState(false);
  if (a.couvertureUrl && !failed) {
    return (
      <img
        src={a.couvertureUrl}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="size-11 flex-none rounded-md object-cover"
      />
    );
  }
  const taxo = taxoOf(a.categorie?.code);
  return (
    <div className={TILE}>
      {taxo ? <CategoryIcon id={taxo.id} /> : <Megaphone aria-hidden className="size-5 text-de9-faint" strokeWidth={1.5} />}
    </div>
  );
}

interface AnnonceRowsProps {
  annonces: AnnonceCarte[];
  /** The row's « Demander un devis »: the selection stays per company, the annonce gives the category to ask for. */
  onDevis: (annonce: AnnonceCarte) => void;
  devisDisabled?: boolean;
  /** Added to each row — the profile frames its rows like its other lists. */
  rowClassName?: string;
}

export function AnnonceRows({ annonces, onDevis, devisDisabled, rowClassName }: AnnonceRowsProps) {
  const t = useT();
  return (
    <div className="flex flex-col gap-2.5">
      {annonces.map((a) => {
        const meta = [a.tarifLabel, a.zonesLabel].filter(Boolean).join(' · ');
        return (
          <div key={a.id} className={cn('flex items-start gap-2.5', rowClassName)}>
            <AnnonceCover annonce={a} />
            <div className="min-w-0 flex-1">
              <Link
                to={`/annonces/${encodeURIComponent(a.id)}`}
                dir="auto"
                className="block truncate text-[12.5px] font-extrabold text-de9-ink no-underline underline-offset-2 hover:underline ltr:text-left rtl:text-right"
              >
                {a.titre}
              </Link>
              {/* French from the server: isolated, the Arabic UI keeps « 4 000 – 9 000 DA / jour » in order. */}
              {meta && (
                <div className="truncate text-[11.5px] text-de9-slate">
                  <bdi>{meta}</bdi>
                </div>
              )}
              {/* On a narrow row the button drops under the delay instead of cutting it. */}
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                {a.delaiLabel && (
                  <span className="min-w-0 text-[11px] text-de9-gray">
                    <bdi>{a.delaiLabel}</bdi>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onDevis(a)}
                  disabled={devisDisabled}
                  className="ms-auto flex-none cursor-pointer rounded-full bg-secondary-container px-[11px] py-1.5 text-[11px] font-bold text-on-secondary-container disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {t('presDemanderDevis')}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
