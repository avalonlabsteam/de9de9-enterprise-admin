import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  type LucideIcon,
  Accessibility,
  ChartColumn,
  ClipboardList,
  CreditCard,
  Eye,
  Handshake,
  History,
  KeyRound,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  ReceiptText,
  ShieldCheck,
  Sun,
  SunMoon,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PresProfileHost } from "@/features/prestataires/components/ProfileHost";
import { ClientFicheHost } from "@/features/clients/components/ClientFicheHost";
import { WorkerViewHost } from "@/features/commandes/components/console/WorkerViewHost";
import { useKycKpis } from "@/features/kyc/api/kyc";
import { useAccesEchecsBadge } from "@/features/acces/api/acces";
import { useAnnoncesBadge } from "@/features/annonces/api/annonces";
import { useComptaAVerifierBadge } from "@/features/comptabilite/api/comptabilite";
import { AlertesBell } from "@/features/alertes/components/AlertesBell";
import { useAlertesHub } from "@/features/alertes/lib/useAlertesHub";
import { logout } from "@/features/auth/api/auth";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/common/Logo";
import { Glyph } from "@/components/common/Glyph";
import { useT, type TKey } from "@/lib/i18n";
import { dirOf, langActions, useLangStore } from "@/stores/langStore";
import { useUiStore } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import { themeActions, useThemeStore, type ThemeMode } from "@/stores/themeStore";

const NAV_ITEMS: ReadonlyArray<{ to: string; labelKey: TKey; icon: LucideIcon }> = [
  { to: "/commandes", labelKey: "navCommandes", icon: ClipboardList },
  { to: "/prestataires", labelKey: "navPrestataires", icon: Users },
  { to: "/annonces", labelKey: "navAnnonces", icon: Megaphone },
  { to: "/kyc", labelKey: "navKyc", icon: ShieldCheck },
  { to: "/acces", labelKey: "navAcces", icon: KeyRound },
  { to: "/soustraitance", labelKey: "navSoustraitance", icon: Handshake },
  { to: "/handicap", labelKey: "navHandicap", icon: Accessibility },
  { to: "/factures", labelKey: "navFactures", icon: ReceiptText },
  { to: "/credits", labelKey: "navCredits", icon: History },
  { to: "/comptabilite", labelKey: "navComptabilite", icon: CreditCard },
  { to: "/analytics", labelKey: "navAnalytics", icon: ChartColumn },
];

const THEME_ICONS: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: SunMoon,
};

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const t = useT();
  // KYC dossiers submitted and waiting on de9de9 — the red badge.
  const { data: kycKpis } = useKycKpis();
  // Annonces waiting for an admin: « À valider » + « Modifiées ».
  const annonces = useAnnoncesBadge();
  // Companies whose sync with the de9de9 app is in « Échec ».
  const syncEchecs = useAccesEchecsBadge();
  // Online payments « à vérifier » created this month.
  const aVerifier = useComptaAVerifierBadge();
  const badges: Partial<Record<string, number>> = {
    "/annonces": annonces,
    "/kyc": kycKpis?.aExaminer,
    "/acces": syncEchecs,
    "/comptabilite": aVerifier,
  };
  const badgeAria: Partial<Record<string, TKey>> = {
    "/annonces": "annoncesBadgeAria",
    "/kyc": "kycBadgeAria",
    "/acces": "accesBadgeAria",
    "/comptabilite": "comptaBadgeAria",
  };
  return (
    <nav className="flex flex-col">
      {NAV_ITEMS.map((item) => {
        const badge = badges[item.to] ?? 0;
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              // Navigation drawer destination: the active one sits on a full-height indicator.
              cn(
                "flex h-14 cursor-pointer items-center gap-3 whitespace-nowrap rounded-full ps-4 pe-6 text-sm font-medium",
                isActive
                  ? "bg-secondary-container text-on-secondary-container"
                  : "bg-transparent text-on-surface-variant",
              )
            }
          >
            <Icon className="size-6 flex-none" strokeWidth={1.75} />
            <span className="min-w-0 flex-1 truncate">{t(item.labelKey)}</span>
            {badge > 0 && (
              <span
                aria-label={t(badgeAria[item.to] ?? "kycBadgeAria").replace("{n}", String(badge))}
                className="min-w-4 rounded-full bg-de9-red px-1 text-center text-[11px] leading-4 font-medium text-white"
              >
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}

function RoleViewBanner() {
  const roleView = useUiStore((s) => s.roleView);
  const t = useT();
  if (roleView === "de9") return null;
  const isClient = roleView === "client";
  return (
    <div
      className={cn(
        "mb-4 flex items-center gap-2.5 rounded-sm border px-4.5 py-3",
        isClient
          ? "border-[#BFD9F2] bg-[#EAF2FD] dark:border-[#2F7FD0]/40 dark:bg-[#2F7FD0]/15"
          : "border-[#BEE6CE] bg-[#E7F6EE] dark:border-[#2FA86A]/40 dark:bg-[#2FA86A]/15",
      )}
    >
      <span className="text-lg"><Glyph icon={Eye} /></span>
      <span className="text-[13.5px] font-semibold text-de9-slate">
        {t("vousRegardez")}{" "}
        <b
          className={cn(
            "font-extrabold",
            isClient ? "text-[#2F7FD0] dark:text-[#7EB5EC]" : "text-[#2FA86A] dark:text-[#6FCF97]",
          )}
        >
          {isClient ? t("roleClient") : t("rolePrestataire")}
        </b>
      </span>
    </div>
  );
}

// Standard icon button of the top app bar.
const iconButtonCls =
  "flex size-10 flex-none cursor-pointer items-center justify-center rounded-full text-sm font-medium text-on-surface-variant";

export function AppLayout() {
  const t = useT();
  const navigate = useNavigate();
  const lang = useLangStore((s) => s.lang);
  const mode = useThemeStore((s) => s.mode);
  const userEmail = useAuthStore((s) => s.user?.email ?? null);
  const dir = dirOf(lang);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Live alerts: one hub connection for as long as the signed-in shell is up.
  useAlertesHub();

  const onLogout = (): void => {
    logout();
    toast.success(t("deconnexionToast"));
    navigate("/login", { replace: true });
  };

  const ThemeIcon = THEME_ICONS[mode];

  return (
    <div className="flex min-h-screen items-stretch">
      {/* ===== Navigation drawer (desktop) ===== */}
      <aside className="sticky top-0 hidden h-screen w-[264px] flex-none flex-col gap-4 self-start overflow-y-auto bg-sidebar px-3 py-4 lg:flex">
        <div className="px-4 py-1">
          <Logo />
        </div>
        <NavList />
      </aside>

      {/* ===== Main column ===== */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top app bar */}
        <header className="sticky top-0 z-40 bg-background">
          <div className="flex h-16 items-center gap-1 px-2 sm:px-4">
            {/* Mobile nav trigger + logo */}
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <button type="button" className={cn(iconButtonCls, "lg:hidden")} aria-label="Menu">
                  <Menu className="size-6" />
                </button>
              </SheetTrigger>
              <SheetContent side={dir === "rtl" ? "right" : "left"} className="w-[300px] gap-0 px-3 py-4">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="mb-4 px-4 py-1">
                  <Logo />
                </div>
                <NavList onNavigate={() => setMobileNavOpen(false)} />
              </SheetContent>
            </Sheet>
            <div className="lg:hidden">
              {/* No room for the « ADMIN » tag beside four header buttons on a phone; the menu shows it. */}
              <Logo size="sm" hideTag />
            </div>

            <div className="flex-1" />

            <button
              type="button"
              onClick={themeActions.cycle}
              className={iconButtonCls}
              aria-label={`Theme: ${mode}`}
              title={`Theme: ${mode}`}
            >
              <ThemeIcon className="size-6" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={langActions.toggle}
              className={iconButtonCls}
              aria-label="Toggle language"
            >
              {lang === "fr" ? "ع" : "FR"}
            </button>

            <AlertesBell />

            {userEmail && (
              <span
                className="ms-2 hidden max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap text-sm text-on-surface-variant md:block"
                title={userEmail}
              >
                {userEmail}
              </span>
            )}
            <button
              type="button"
              onClick={onLogout}
              className={iconButtonCls}
              aria-label={t("deconnexion")}
              title={t("deconnexion")}
            >
              <LogOut className="size-6 rtl:rotate-180" strokeWidth={1.75} />
            </button>
          </div>
        </header>

        {/* Body */}
        <main className="mx-auto w-full max-w-[1320px] px-4 pb-[60px] pt-2 sm:px-6">
          <RoleViewBanner />
          <Outlet />
        </main>
      </div>

      {/* Global overlays driven by search params (?pres= / ?client= / ?worker=) */}
      <PresProfileHost />
      <ClientFicheHost />
      <WorkerViewHost />

    </div>
  );
}
