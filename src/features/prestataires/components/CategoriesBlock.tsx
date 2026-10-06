// Every category of a company, each in the colour of its catalogue family
// with its own services under it — `categoriesDetaillees`, grouped by the
// server and drawn in the order received (a search puts the asked ones first).
// The search card shows three categories and three services of each; the
// profile shows them all. A colour is a family of services, not a grade.
import type { ReactNode } from 'react';
import { useT, type TKey } from '@/lib/i18n';
import { cn, isInk } from '@/lib/utils';
import type { CategorieDetail } from '../schemas/recherche';

/** A card draws this many categories, and this many services of each. */
const CATEGORIES_PAR_CARTE = 3;
const SERVICES_PAR_LIGNE = 3;

type Translate = (key: TKey) => string;

const count = (n: number, one: TKey, many: TKey, t: Translate): string =>
  n === 1 ? t(one) : t(many).replace('{n}', String(n));

const PILL = 'rounded-full px-2 py-[2px] text-[10px] font-bold whitespace-nowrap';
const PILL_NEUTRE = 'bg-secondary text-de9-slate';
const LABEL = 'text-[11px] font-extrabold tracking-[.04em] text-de9-gray uppercase';

/**
 * One category: a bar and a label in its family's colour, then whatever goes
 * under them. « Noir » is the light theme's ink: on dark it takes the ink's
 * stand-in, like the avatar. Without a family, neutral grey.
 */
function Row({ categorie: c, pills, children, className }: { categorie: CategorieDetail; pills: ReactNode; children: ReactNode; className?: string }) {
  const hex = c.famille?.hex ?? null;
  return (
    <div className={cn('flex gap-2.5', className)}>
      <span
        aria-hidden
        className={cn('w-[3px] flex-none self-stretch rounded-full', hex ? isInk(hex) && 'tone-ink-bg' : 'bg-[#C7CFD7] dark:bg-[#3A4356]')}
        style={hex ? { background: hex } : undefined}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span
            dir="auto"
            className={cn('text-[12px] leading-snug font-bold', hex ? isInk(hex) && 'tone-ink' : 'text-de9-slate')}
            style={hex ? { color: hex } : undefined}
          >
            {c.label}
          </span>
          {pills}
        </div>
        {children}
      </div>
    </div>
  );
}

/** The search card's block « Catégories (N) ». `onMore`: the profile, where the rest is. */
export function CategoriesCard({ categories, onMore, className }: { categories: CategorieDetail[]; onMore: () => void; className?: string }) {
  const t = useT();
  const services = categories.reduce((sum, c) => sum + c.sousCategories.length, 0);
  const autres = categories.length - CATEGORIES_PAR_CARTE;
  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div className={LABEL}>{t('presCategoriesN').replace('{n}', String(categories.length))}</div>
        {services > 0 && (
          <div className="flex-none text-[11px] font-semibold text-de9-gray">{count(services, 'presService1', 'presServicesN', t)}</div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {categories.slice(0, CATEGORIES_PAR_CARTE).map((c) => {
          const reste = c.sousCategories.length - SERVICES_PAR_LIGNE;
          return (
            <Row
              key={c.code}
              categorie={c}
              pills={
                <>
                  {c.sousCategories.length > 0 && (
                    <span className={cn(PILL, PILL_NEUTRE)}>{count(c.sousCategories.length, 'presService1', 'presServicesN', t)}</span>
                  )}
                  {c.annonces > 0 && <span className={cn(PILL, PILL_NEUTRE)}>{count(c.annonces, 'presAnnonce1', 'presAnnoncesNb', t)}</span>}
                  {c.demandee && <span className={cn(PILL, 'bg-secondary-container text-on-secondary-container')}>{t('presRecherchee')}</span>}
                </>
              }
            >
              {c.sousCategories.length > 0 && (
                <div dir="auto" className="mt-0.5 text-[11.5px] leading-snug text-de9-slate ltr:text-left rtl:text-right">
                  {c.sousCategories
                    .slice(0, SERVICES_PAR_LIGNE)
                    .map((s) => s.label)
                    .join(' · ')}
                  {reste > 0 && <span className="num font-bold text-de9-gray"> +{reste}</span>}
                </div>
              )}
            </Row>
          );
        })}
      </div>
      {autres > 0 && (
        <button
          type="button"
          onClick={onMore}
          className="mt-2 cursor-pointer text-[12px] font-bold text-de9-teal-dark underline-offset-2 hover:underline"
        >
          {count(autres, 'presAutreCategorie1', 'presAutresCategoriesN', t)}
        </button>
      )}
    </div>
  );
}

/** The profile's « Catégories et services (N) »: every category, every service. */
export function CategoriesDetail({ categories }: { categories: CategorieDetail[] }) {
  const t = useT();
  return (
    <div>
      <div className={LABEL}>{t('presCategoriesServicesN').replace('{n}', String(categories.length))}</div>
      <div className={cn('mt-2 grid gap-2', categories.length > 1 && 'sm:grid-cols-2')}>
        {categories.map((c) => (
          <Row
            key={c.code}
            categorie={c}
            className="rounded-md border border-de9-line px-3 py-2.5"
            pills={
              <>
                {c.surFiche && <span className={cn(PILL, PILL_NEUTRE)}>{t('presPillFiche')}</span>}
                {c.annonces > 0 && <span className={cn(PILL, PILL_NEUTRE)}>{count(c.annonces, 'presAnnonce1', 'presAnnoncesNb', t)}</span>}
              </>
            }
          >
            <div dir="auto" className="mt-1 text-[12px] leading-[1.5] text-de9-slate ltr:text-left rtl:text-right">
              {c.sousCategories.map((s) => s.label).join(' · ') || '—'}
            </div>
            {!c.surFiche && <div className="mt-1 text-[11px] leading-snug text-de9-gray">{t('presHorsFiche')}</div>}
          </Row>
        ))}
      </div>
    </div>
  );
}
