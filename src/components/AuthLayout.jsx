import React from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useIsMobileView } from "@/lib/useIsMobileView";
import { cn } from "@/lib/utils";

/**
 * Screen 03 — auth shell (sign in / sign up / recovery).
 * Same navy stage, gold emblem and cyan accents as the splash and onboarding.
 */
function Glow() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-1/2 top-[-10%] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-accent/10 blur-[130px]" />
      <div className="absolute left-1/2 top-[-4%] h-[220px] w-[220px] -translate-x-1/2 rounded-full bg-primary/15 blur-[90px]" />
    </div>
  );
}

function Emblem({ icon: Icon, size = "lg" }) {
  const box = size === "lg" ? "h-24 w-24" : "h-20 w-20";
  const inner = size === "lg" ? "h-8 w-8" : "h-7 w-7";
  return (
    <div className={cn("relative grid place-items-center", box)}>
      <span className="absolute inset-0 rounded-full border border-accent/20" />
      <span className="absolute inset-3 rounded-full border border-primary/25" />
      <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-primary shadow-[0_0_38px_hsl(var(--primary)/0.35)]">
        <Icon className={cn("text-primary-foreground", inner)} aria-hidden="true" />
      </span>
    </div>
  );
}

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  const isMobile = useIsMobileView();
  const { t, dir } = useI18n();

  if (isMobile) {
    // Native app shell: full-screen sheet, back affordance, no card chrome.
    return (
      <div className="relative min-h-screen bg-background flex flex-col overflow-hidden" dir={dir}>
        <Glow />
        <header className="relative h-14 px-2 flex items-center gap-1 pt-[env(safe-area-inset-top)]">
          <Link
            to="/"
            aria-label={t.nav.home}
            className="w-10 h-10 rounded-xl grid place-items-center text-muted-foreground transition-colors hover:bg-secondary hover:text-accent"
          >
            <ChevronLeft className={cn("w-5 h-5")} />
          </Link>
        </header>
        <div className="relative flex-1 px-5 pt-2 pb-[calc(24px+env(safe-area-inset-bottom))] overflow-y-auto">
          <div className="mx-auto max-w-md">
            <div className="mb-6 flex flex-col items-center text-center">
              <Emblem icon={Icon} size="sm" />
              <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-foreground">
                {title}
              </h1>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.4em] text-accent/70">
                MIZAD
              </p>
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-3 max-w-xs">{subtitle}</p>
              )}
            </div>
            <div className="native-panel rounded-2xl p-4">{children}</div>
            {footer && <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center bg-background px-4 py-10"
      dir={dir}
    >
      <Glow />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8 flex flex-col items-center">
          <Emblem icon={Icon} />
          <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.45em] text-accent/70">
            MIZAD
          </p>
          {subtitle && <p className="text-muted-foreground mt-3 max-w-sm">{subtitle}</p>}
        </div>
        <div className="native-panel rounded-2xl p-8 shadow-[0_24px_60px_-30px_hsl(var(--primary)/0.25)]">
          {children}
        </div>
        {footer && <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>}
      </div>
    </div>
  );
}
