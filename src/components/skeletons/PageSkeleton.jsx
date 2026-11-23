import React from "react";
import { Gavel } from "lucide-react";

/**
 * Router defaultPendingComponent. With defaultPendingMs Infinity it only
 * renders on the very first load (in-app navigations keep the current page and
 * show RouteProgressBar), possibly inside a layout's <Outlet />, so it covers
 * the whole screen with the brand splash.
 */
export function FirstLoadPending() {
  return (
    <div className="fixed inset-0 z-40">
      <AppShellSkeleton />
    </div>
  );
}

/**
 * Full-screen splash shown while the session/profile is being resolved (hard
 * refresh / first load). It is deliberately not page-shaped: at this point we
 * don't know which layout the page uses, so a guessed skeleton would be wrong
 * on most routes.
 */
export function AppShellSkeleton() {
  return (
    <div
      className="grid min-h-screen place-items-center bg-background"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="flex flex-col items-center gap-5">
        <div className="grid h-14 w-14 animate-pulse place-items-center rounded-2xl border border-primary/50 bg-primary text-primary-foreground shadow-[0_0_32px_hsl(var(--primary)/0.25)]">
          <Gavel className="h-7 w-7" />
        </div>
        <div className="flex gap-1.5" aria-hidden="true">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
