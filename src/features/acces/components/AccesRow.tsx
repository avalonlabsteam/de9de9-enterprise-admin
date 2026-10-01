// One company of the « Accès » list. Memoized: at 200 rows a page, ticking a
// box must repaint that row, not the table — so every prop is either the row
// itself or stable across renders.
import { memo, useState, type ReactNode } from 'react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { Check, Ellipsis, Minus } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { fmtAlger } from '@/features/comptabilite/lib/comptabilite';
import { ACCES_GRID, ACTIONS, initialsOf, kycPill, roleLabel, tonPill, type AccesAction } from '../lib/acces';
import type { AccesEntreprise } from '../schemas/acces';
import { targetOf, type AccesTarget } from '../stores/selectionStore';

const PILL = 'inline-flex max-w-full items-center rounded-full px-2.5 py-[5px] text-[11px] font-bold';
const SUB_LINE = 'mt-1 line-clamp-2 text-[11px] leading-[1.4] text-de9-gray';
const MENU_ITEM = 'cursor-pointer text-[12.5px] font-semibold';

/** A dictionary line with one `{n}` slot, filled with an element (a date that keeps its reading order in Arabic). */
function Slot({ text, children }: { text: string; children: ReactNode }) {
  const [before, after = ''] = text.split('{n}');
  return (
    <>
      {before}
      {children}
      {after}
    </>
  );
}

export function Tick({
  state,
  label,
  title,
  disabled = false,
  onToggle,
}: {
  state: boolean | 'indeterminate';
  /** Read by screen readers: the box has no text. */
  label: string;
  title?: string;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    // The tooltip sits on a wrapper: a disabled button shows none.
    <span title={title} className="inline-flex">
      <CheckboxPrimitive.Root
        checked={state}
        disabled={disabled}
        aria-label={label}
        onCheckedChange={onToggle}
        className="relative flex size-[18px] flex-none cursor-pointer items-center justify-center rounded-[2px] border-2 border-on-surface-variant text-primary-foreground outline-none after:absolute after:-inset-2 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-38 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary"
      >
        <CheckboxPrimitive.Indicator className="grid place-content-center [&>svg]:size-3.5">
          {state === 'indeterminate' ? <Minus strokeWidth={3} /> : <Check strokeWidth={3} />}
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    </span>
  );
}

function CompanyLogo({ url, nom }: { url: string | null | undefined; nom: string }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="size-9 flex-none rounded-md object-cover"
      />
    );
  }
  return (
    <div className="flex size-9 flex-none items-center justify-center rounded-md bg-primary-container text-[12px] font-extrabold text-on-primary-container">
      {initialsOf(nom)}
    </div>
  );
}

interface AccesRowProps {
  row: AccesEntreprise;
  selected: boolean;
  /** The selection holds its 200 companies: this row cannot join it. */
  full: boolean;
  /** A « Relancer » is running. */
  retrying: boolean;
  onToggle: (target: AccesTarget) => void;
  /** The switch and the menu ask first — the dialog of that one company. */
  onAsk: (action: AccesAction, target: AccesTarget) => void;
  onRelancer: (companyId: string) => void;
  onVoirSync: (companyId: string) => void;
}

export const AccesRow = memo(function AccesRow({
  row: r,
  selected,
  full,
  retrying,
  onToggle,
  onAsk,
  onRelancer,
  onVoirSync,
}: AccesRowProps) {
  const t = useT();
  const target = targetOf(r);
  const etat = r.b2cEtat;
  const identity = [r.raisonSociale !== target.nom ? r.raisonSociale : null, r.rc, r.email].filter(Boolean).join(' · ');
  const b2cDate = fmtAlger(r.b2cModifieLe, false);
  const b2bDate = fmtAlger(r.b2bModifieLe, false);
  const blocked = !selected && full;

  return (
    <div
      className={cn(
        'grid items-start gap-3 border-b border-de9-line px-5 py-3.5',
        ACCES_GRID,
        selected && 'bg-[#ECFAF8] dark:bg-[#2C9C94]/15',
      )}
    >
      <div className="flex pt-[9px]">
        <Tick
          state={selected}
          label={t('accesSelectRow').replace('{n}', target.nom)}
          title={blocked ? t('accesMax200') : undefined}
          disabled={blocked}
          onToggle={() => onToggle(target)}
        />
      </div>

      {/* entreprise */}
      <div className="flex min-w-0 items-start gap-3">
        <CompanyLogo url={r.logoUrl} nom={target.nom} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <bdi className="text-[13px] font-bold text-de9-ink">{target.nom}</bdi>
            {r.active === false && (
              <span className="rounded-full bg-[#FDECEC] px-2 py-[2px] text-[10px] font-extrabold text-de9-red dark:bg-[#E7464E]/15">
                {t('accesDesactivee')}
              </span>
            )}
          </div>
          {identity && (
            <div dir="auto" title={identity} className="mt-0.5 truncate text-[11px] text-de9-gray ltr:text-left rtl:text-right">
              {identity}
            </div>
          )}
          {target.roles.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {target.roles.map((role) => (
                <span key={role} className="rounded-full bg-secondary px-2 py-[2px] text-[10px] font-bold text-de9-slate">
                  {roleLabel(role, t)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* KYC */}
      <div className="min-w-0 pt-[5px]">
        <span className={cn(PILL, kycPill(r.kycStatut))}>{r.kycStatutLabel ?? r.kycStatut ?? '—'}</span>
      </div>

      {/* B2C — the server's pill, never re-derived */}
      <div className="min-w-0 pt-[5px]">
        <span className={cn(PILL, tonPill(etat?.ton))}>
          {etat?.label ?? etat?.code ?? t(r.b2cAcces ? 'accesB2cAccorde' : 'accesB2cNonAccorde')}
        </span>
        {etat?.detail ? (
          <div dir="auto" title={etat.detail} className={cn(SUB_LINE, 'ltr:text-left rtl:text-right')}>
            {etat.detail}
          </div>
        ) : r.b2cAcces && b2cDate ? (
          <div className={SUB_LINE} title={r.b2cMotif ?? undefined}>
            <Slot text={t('accesAccordeLe')}>
              <span className="num">{b2cDate}</span>
            </Slot>
            {r.b2cMotif && (
              <>
                {' — '}
                <bdi>{r.b2cMotif}</bdi>
              </>
            )}
          </div>
        ) : null}
      </div>

      {/* B2B — the switch asks first, and only moves once the server said « fait » */}
      <div className="min-w-0 pt-[3px]">
        <div className="flex items-center gap-2">
          <Switch
            size="sm"
            checked={r.b2bAcces}
            aria-label={t(ACTIONS[r.b2bAcces ? 'b2b_desactiver' : 'b2b_activer'].labelKey)}
            onCheckedChange={() => onAsk(r.b2bAcces ? 'b2b_desactiver' : 'b2b_activer', target)}
            className="cursor-pointer"
          />
          <span className={cn('text-[12px] font-bold', r.b2bAcces ? 'text-de9-ink' : 'text-[#B68A2E] dark:text-[#D9B36A]')}>
            {t(r.b2bAcces ? 'accesActif' : 'accesSuspendu')}
          </span>
        </div>
        {!r.b2bAcces && (b2bDate || r.b2bMotif) && (
          <div className={SUB_LINE} title={r.b2bMotif ?? undefined}>
            {b2bDate && (
              <Slot text={t('accesDepuisLe')}>
                <span className="num">{b2bDate}</span>
              </Slot>
            )}
            {r.b2bMotif && (
              <>
                {b2bDate && ' — '}
                <bdi>{r.b2bMotif}</bdi>
              </>
            )}
          </div>
        )}
      </div>

      {/* ⋯ — one company, built from the row */}
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t('accesMenu').replace('{n}', target.nom)}
              className="flex size-8 flex-none cursor-pointer items-center justify-center rounded-full text-de9-slate hover:bg-secondary"
            >
              <Ellipsis className="size-[18px]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[250px]">
            {r.b2cAcces ? (
              <DropdownMenuItem variant="destructive" onSelect={() => onAsk('b2c_retirer', target)} className={MENU_ITEM}>
                {t('accesRetirerB2c')}…
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => onAsk('b2c_accorder', target)} className={MENU_ITEM}>
                {t('accesAccorderB2c')}
              </DropdownMenuItem>
            )}
            {(r.b2cAcces || etat?.code === 'echec') && (
              <DropdownMenuItem disabled={retrying} onSelect={() => onRelancer(r.id)} className={MENU_ITEM}>
                {t('accesRelancer')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => onVoirSync(r.id)} className={MENU_ITEM}>
              {t('accesVoirSync')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});
