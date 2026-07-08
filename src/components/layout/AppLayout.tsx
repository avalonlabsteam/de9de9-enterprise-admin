import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Menu, Moon, Sun, SunMoon } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PresProfileHost } from "@/features/prestataires/components/ProfileHost";
import { ClientFicheHost } from "@/features/clients/components/ClientFicheHost";
import { WorkerViewHost } from "@/features/commandes/components/console/WorkerViewHost";
import { cn } from "@/lib/utils";
import { useT, type TKey } from "@/lib/i18n";
import { dirOf, langActions, useLangStore } from "@/stores/langStore";
import { useUiStore } from "@/stores/uiStore";
import { resolveTheme, themeActions, useThemeStore, type ThemeMode } from "@/stores/themeStore";

const NAV_ITEMS: ReadonlyArray<{ to: string; labelKey: TKey }> = [
  { to: "/commandes", labelKey: "navCommandes" },
  { to: "/prestataires", labelKey: "navPrestataires" },
  { to: "/soustraitance", labelKey: "navSoustraitance" },
  { to: "/handicap", labelKey: "navHandicap" },
  { to: "/factures", labelKey: "navFactures" },
  { to: "/credits", labelKey: "navCredits" },
  { to: "/analytics", labelKey: "navAnalytics" },
];

const THEME_ICONS: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: SunMoon,
};

function Logo() {
  const t = useT();
  return (
    <div className="flex items-center gap-[11px]">
      <div className="leading-[0.82]">
        <span className="text-[21px] font-extrabold">
          <span className="text-de9-red">De9</span>{" "}
          <span className="text-de9-teal">De9</span>
        </span>
      </div>
      <div className="rounded-[7px] bg-de9-ink px-[9px] py-1 text-[10.5px] font-extrabold tracking-[.12em] text-white dark:text-[#151923]">
        {t("admin")}
      </div>
    </div>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const t = useT();
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "cursor-pointer whitespace-nowrap rounded-[11px] px-3.5 py-[11px] text-[13.5px] font-bold",
              isActive
                ? "bg-[#E9F6F5] text-de9-teal-dark dark:bg-[#14322E]"
                : "bg-transparent text-de9-gray hover:text-de9-slate",
            )
          }
        >
          {t(item.labelKey)}
        </NavLink>
      ))}
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
        "mb-4 flex items-center gap-2.5 rounded-[13px] border-[1.5px] px-4.5 py-3",
        isClient
          ? "border-[#BFD9F2] bg-[#EAF2FD] dark:border-[#2F7FD0]/40 dark:bg-[#2F7FD0]/15"
          : "border-[#BEE6CE] bg-[#E7F6EE] dark:border-[#2FA86A]/40 dark:bg-[#2FA86A]/15",
      )}
    >
      <span className="text-lg">👁</span>
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

const iconButtonCls =
  "flex h-[38px] w-11 flex-none cursor-pointer items-center justify-center rounded-[11px] border-[1.5px] border-de9-line text-[13px] font-extrabold text-de9-slate hover:bg-de9-row";

export function AppLayout() {
  const lang = useLangStore((s) => s.lang);
  const mode = useThemeStore((s) => s.mode);
  const dir = dirOf(lang);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [dir, lang]);

  // Apply the theme class; track OS preference while in "system" mode.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.classList.toggle(
        "dark",
        resolveTheme(mode, media.matches) === "dark",
      );
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [mode]);

  const ThemeIcon = THEME_ICONS[mode];

  return (
    <div className="flex min-h-screen items-stretch">
      {/* ===== Sidebar (desktop) ===== */}
      <aside className="sticky top-0 hidden h-screen w-[236px] flex-none flex-col gap-6 self-start border-e border-de9-line bg-card px-4 py-[22px] shadow-[0_4px_20px_rgba(38,50,69,.04)] lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <NavList />
      </aside>

      {/* ===== Main column ===== */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 border-b border-de9-line bg-card shadow-[0_4px_20px_rgba(38,50,69,.04)]">
          <div className="flex h-[66px] items-center gap-2.5 px-4 sm:gap-4 sm:px-[26px]">
            {/* Mobile nav trigger + logo */}
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <button type="button" className={cn(iconButtonCls, "lg:hidden")} aria-label="Menu">
                  <Menu className="size-[18px]" />
                </button>
              </SheetTrigger>
              <SheetContent side={dir === "rtl" ? "right" : "left"} className="w-[260px] gap-0 bg-card p-4 pt-6">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="mb-6 px-2">
                  <Logo />
                </div>
                <NavList onNavigate={() => setMobileNavOpen(false)} />
              </SheetContent>
            </Sheet>
            <div className="lg:hidden">
              <Logo />
            </div>

            <div className="flex-1" />

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
              {lang === "fr" ? "ع" : "FR"}
            </button>
          </div>
        </header>

        {/* Body */}
        <main className="mx-auto w-full max-w-[1320px] px-4 pb-[60px] pt-6 sm:px-[26px]">
          <RoleViewBanner />
          <Outlet />
        </main>
      </div>

      {/* Global overlays driven by search params (?pres= / ?client= / ?worker=) */}
      <PresProfileHost />
      <ClientFicheHost />
      <WorkerViewHost />

      <Toaster position="bottom-center" />
    </div>
  );
}
