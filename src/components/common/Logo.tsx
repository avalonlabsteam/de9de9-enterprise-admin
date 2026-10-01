import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';

const HEIGHT = { sm: 'h-10', md: 'h-[54px]', lg: 'h-[104px]' } as const;

interface LogoProps {
  className?: string;
  /** sm: the phone header · md: the sidebar · lg: the login page (tag underneath). */
  size?: keyof typeof HEIGHT;
  /** Drop the « ADMIN » tag where the row has no room for it (the phone header). */
  hideTag?: boolean;
}

/**
 * « De9 De9 · Entreprise » brand lockup — the same artwork as the company web
 * app (`public/logo-brand.png`) — with the panel's « ADMIN » tag beside it.
 */
export function Logo({ className, size = 'md', hideTag = false }: LogoProps) {
  const t = useT();
  return (
    <div className={cn('flex items-center', size === 'lg' ? 'flex-col gap-3' : 'gap-2.5', className)}>
      <img
        src="/logo-brand.png"
        alt="De9 De9 Entreprise"
        width={208}
        height={232}
        draggable={false}
        className={cn('w-auto flex-none select-none', HEIGHT[size])}
      />
      {!hideTag && (
        <span className="rounded-xs bg-inverse-surface px-[9px] py-1 text-[10.5px] font-extrabold tracking-[.12em] text-inverse-on-surface">
          {t('admin')}
        </span>
      )}
    </div>
  );
}
