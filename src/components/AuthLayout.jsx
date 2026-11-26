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
  // Three concentric circles: outer ring, inner ring, then the filled badge,
  // each sized so the badge sits fully inside the inner ring.
  const lg = size === "lg";
  return (
    <div className={cn("relative grid place-items-center", lg ? "h-24 w-24" : "h-20 w-20")}>
      <span className="absolute inset-0 rounded-full border border-accent/20" />
      <span className="absolute inset-2.5 rounded-full border border-primary/25" />
      <span className={cn("relative grid place-items-center rounded-full bg-primary shadow-[0_0_38px_hsl(var(--primary)/0.35)]", lg ? "h-14 w-14" : "h-12 w-12")}>
        <Icon className={cn("text-primary-foreground", lg ? "h-7 w-7" : "h-6 w-6")} aria-hidden="true" />
      </span>
    </div>
  );
}

/**
 * `compact`: the page fits one screen height (no page scroll) for long forms
 * such as sign-up: smaller header, tighter card. On a very short screen the
 * form area alone scrolls, so nothing is ever cut off.
 */
function CompactAuthLayout({ icon: Icon, title, subtitle, footer, children, isMobile, t, dir }) {
  return (
    <div className="relative h-[100dvh] overflow-hidden bg-background flex flex-col" dir={dir}>
      <Glow />
      {isMobile ? (
        <header className="relative shrink-0 h-12 px-2 flex items-center gap-1 pt-[env(safe-area-inset-top)]">
          <Link
            to="/"
            aria-label={t.nav.home}
            className="w-10 h-10 rounded-xl grid place-items-center text-muted-foreground transition-colors hover:bg-secondary hover:text-accent"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
        </header>
      ) : null}
      <div
        className={cn(
          "relative flex-1 min-h-0 overflow-y-auto flex flex-col",
          isMobile ? "px-4 pb-[calc(12px+env(safe-area-inset-bottom))]" : "px-4 py-6"
        )}
      >
        <div className={cn("m-auto w-full", isMobile ? "max-w-md" : "max-w-xl")}>
          <div className={cn("flex items-center gap-3", isMobile ? "mb-3" : "mb-5 justify-center")}>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary shadow-[0_0_28px_hsl(var(--primary)/0.35)]">
              <Icon className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className={cn("font-display font-extrabold tracking-tight text-foreground leading-tight", isMobile ? "text-xl" : "text-2xl")}>
                {title}
              </h1>
              {subtitle ? <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p> : null}
            </div>
          </div>
          <div
            className={cn(
              "native-panel rounded-2xl",
              isMobile ? "p-4" : "p-6 shadow-[0_24px_60px_-30px_hsl(var(--primary)/0.25)]"
            )}
          >
            {children}
          </div>
          {footer ? <p className={cn("text-center text-sm text-muted-foreground", isMobile ? "mt-3" : "mt-4")}>{footer}</p> : null}
        </div>
      </div>
    </div>
  );
}

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children, compact = false }) {
  const isMobile = useIsMobileView();
  const { t, dir } = useI18n();

  if (compact) {
    return (
      <CompactAuthLayout icon={Icon} title={title} subtitle={subtitle} footer={footer} isMobile={isMobile} t={t} dir={dir}>
        {children}
      </CompactAuthLayout>
    );
  }

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
                BIDKITA
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
            BIDKITA
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
