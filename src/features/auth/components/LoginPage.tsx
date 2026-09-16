import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, Moon, Sun, SunMoon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useT, type TKey } from '@/lib/i18n';
import { langActions, useLangStore } from '@/stores/langStore';
import { themeActions, useThemeStore, type ThemeMode } from '@/stores/themeStore';
import { useIsAuthenticated } from '@/stores/authStore';
import { loginInputSchema, type LoginInput } from '../schemas/auth';
import { useLogin, type AuthFailure, type AuthFailureKind } from '../api/auth';

const THEME_ICONS: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: SunMoon,
};

const FAILURE_KEY: Record<AuthFailureKind, TKey> = {
  credentials: 'loginErrIdentifiants',
  network: 'loginErrReseau',
  server: 'loginErrServeur',
};

/**
 * The API's problem body carries an English `title` and no `detail`, so the
 * message is chosen from its machine-readable `code` and rendered in the user's
 * language. Unmapped codes fall back to the generic message for the failure kind.
 */
const CODE_KEY: Record<string, TKey> = {
  invalid_credentials: 'loginErrIdentifiants',
};

function failureMessage(failure: AuthFailure): TKey {
  if (failure.code && CODE_KEY[failure.code]) return CODE_KEY[failure.code];
  return FAILURE_KEY[failure.kind];
}

const fieldCls =
  'h-auto w-full rounded-xl border-[1.5px] border-de9-line bg-card px-3.5 py-3 text-[14px] text-de9-ink outline-none transition-colors placeholder:text-de9-gray focus:border-de9-teal';

export function LoginPage() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const lang = useLangStore((s) => s.lang);
  const mode = useThemeStore((s) => s.mode);
  const isAuthenticated = useIsAuthenticated();
  const login = useLogin();

  const [showPassword, setShowPassword] = useState(false);
  const [failure, setFailure] = useState<AuthFailure | null>(null);

  const { register, handleSubmit, formState } = useForm<LoginInput>({
    resolver: zodResolver(loginInputSchema),
    defaultValues: { email: '', password: '' },
  });
  const { errors } = formState;

  // Already signed in — bounce straight through.
  const from = (location.state as { from?: string } | null)?.from;
  if (isAuthenticated) return <Navigate to={from ?? '/commandes'} replace />;

  const onSubmit = handleSubmit((input) => {
    setFailure(null);
    login.mutate(input, {
      onSuccess: (session) => {
        toast.success(t('loginBienvenue').replace('{n}', session.user.email));
        navigate(from ?? '/commandes', { replace: true });
      },
      onError: (err) => setFailure(err.failure),
    });
  });

  const ThemeIcon = THEME_ICONS[mode];
  const iconButtonCls =
    'flex h-[38px] w-11 flex-none cursor-pointer items-center justify-center rounded-[11px] border-[1.5px] border-de9-line bg-card text-[13px] font-extrabold text-de9-slate transition-colors hover:bg-de9-row';

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* top bar — theme + language stay reachable before sign-in */}
      <div className="flex items-center justify-end gap-2.5 px-4 py-4 sm:px-[26px]">
        <button
          type="button"
          onClick={themeActions.cycle}
          className={iconButtonCls}
          aria-label={`Theme: ${mode}`}
          title={`Theme: ${mode}`}
        >
          <ThemeIcon className="size-[18px]" />
        </button>
        <button
          type="button"
          onClick={langActions.toggle}
          className={iconButtonCls}
          aria-label="Toggle language"
        >
          {lang === 'fr' ? 'ع' : 'FR'}
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-[404px]">
          {/* brand */}
          <div className="flex flex-col items-center gap-3">
            <div className="text-[27px] leading-[0.82] font-extrabold">
              <span className="text-de9-red">De9</span> <span className="text-de9-teal">De9</span>
            </div>
            <div className="rounded-[7px] bg-de9-ink px-[9px] py-1 text-[10.5px] font-extrabold tracking-[.12em] text-white dark:text-[#151923]">
              {t('admin')}
            </div>
          </div>

          {/* card */}
          <div className="mt-7 rounded-[20px] border border-de9-line bg-card px-6 py-7 shadow-[0_10px_30px_rgba(38,50,69,.06)] sm:px-7">
            <h1 className="text-[21px] font-extrabold text-de9-ink">{t('loginTitle')}</h1>
            <p className="mt-[3px] text-[13.5px] text-de9-gray">{t('loginSub')}</p>

            <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
              {/* email */}
              <div>
                <label htmlFor="email" className="mb-1.5 block text-[12px] font-bold text-de9-slate">
                  {t('loginEmail')}
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  dir="ltr"
                  placeholder={t('loginEmailPh')}
                  aria-invalid={!!errors.email}
                  className={cn(fieldCls, errors.email && 'border-de9-red focus:border-de9-red')}
                  {...register('email')}
                />
                {errors.email && (
                  <p className="mt-1.5 text-[11.5px] font-semibold text-de9-red">
                    {t('loginEmailInvalide')}
                  </p>
                )}
              </div>

              {/* password */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-[12px] font-bold text-de9-slate"
                >
                  {t('loginPassword')}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    dir="ltr"
                    placeholder={t('loginPasswordPh')}
                    aria-invalid={!!errors.password}
                    className={cn(
                      fieldCls,
                      'pe-12',
                      errors.password && 'border-de9-red focus:border-de9-red',
                    )}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t('loginMasquerMdp') : t('loginAfficherMdp')}
                    className="absolute inset-y-0 end-0 flex w-11 cursor-pointer items-center justify-center rounded-e-xl text-de9-gray hover:text-de9-slate"
                  >
                    {showPassword ? <EyeOff className="size-[17px]" /> : <Eye className="size-[17px]" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1.5 text-[11.5px] font-semibold text-de9-red">
                    {t('loginMdpRequis')}
                  </p>
                )}
              </div>

              {/* server-side failure */}
              {failure && (
                <div
                  role="alert"
                  className="rounded-xl border border-[#F3C9CB] bg-[#FDECEC] px-3.5 py-2.5 text-[12.5px] font-semibold text-de9-red dark:border-[#E7464E]/40 dark:bg-[#E7464E]/15"
                >
                  {t(failureMessage(failure))}
                  {failure.traceId && (
                    <span
                      dir="ltr"
                      className="mt-1 block font-mono text-[10.5px] font-normal opacity-70"
                    >
                      {failure.traceId}
                    </span>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={login.isPending}
                className="mt-1 flex h-[46px] w-full cursor-pointer items-center justify-center gap-2 rounded-[13px] bg-de9-teal-dark text-[14px] font-bold text-white shadow-[0_8px_18px_rgba(23,138,130,.28)] transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {login.isPending && <Loader2 className="size-[17px] animate-spin" />}
                {login.isPending ? t('loginSubmitting') : t('loginSubmit')}
              </button>
            </form>
          </div>

          <p className="mt-5 text-center text-[11.5px] text-de9-gray">{t('loginFooter')}</p>
        </div>
      </div>
    </div>
  );
}
