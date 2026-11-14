import React, { useEffect, useState } from "react";
import { Gavel } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const KEY = "mizad_splash_seen";

/**
 * Screen 01 — Splash / brand screen.
 * Deep navy stage, illuminated gold gavel emblem, wordmark, tagline, loader.
 * Shown once per browser session.
 */
export default function SplashScreen() {
  const { t, dir } = useI18n();
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(KEY) === "1";
    } catch {
      seen = false;
    }
    if (seen) return;
    setShow(true);
    const out = setTimeout(() => setLeaving(true), 1900);
    const done = setTimeout(() => {
      setShow(false);
      try {
        sessionStorage.setItem(KEY, "1");
      } catch {
        /* ignore */
      }
    }, 2500);
    return () => {
      clearTimeout(out);
      clearTimeout(done);
    };
  }, []);

  if (!show) return null;

  const tagline = dir === "rtl" ? "كل قصة تستحق مزاداً" : "Every story deserves an auction";

  return (
    <div
      dir={dir}
      aria-hidden="true"
      className={cn(
        "fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-background transition-opacity duration-500",
        leaving ? "opacity-0" : "opacity-100"
      )}
    >
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-[120px]" />
        <div className="absolute left-1/2 top-[42%] h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[90px]" />
      </div>

      <div className="relative flex flex-col items-center px-8">
        {/* emblem */}
        <div className="relative grid h-40 w-40 place-items-center">
          <span className="absolute inset-0 rounded-full border border-accent/25" />
          <span className="absolute inset-4 rounded-full border border-accent/20" />
          <span className="absolute inset-8 rounded-full border border-primary/30 shadow-[0_0_60px_hsl(var(--primary)/0.25)]" />
          <span className="absolute inset-0 animate-ping rounded-full border border-accent/20 [animation-duration:2.4s]" />
          <Gavel
            className="relative h-16 w-16 text-primary drop-shadow-[0_0_24px_hsl(var(--primary)/0.55)]"
            strokeWidth={1.6}
          />
        </div>

        {/* wordmark */}
        <h1 className="mt-8 font-display text-5xl font-extrabold tracking-tight text-primary drop-shadow-[0_0_28px_hsl(var(--primary)/0.35)]">
          {t.brand}
        </h1>
        <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.5em] text-accent/80">MIZAD</p>

        <p className="mt-6 text-center text-sm text-muted-foreground">{tagline}</p>

        {/* loader */}
        <div className="mt-10 h-1 w-40 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/3 animate-[splashbar_1.6s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-accent to-primary" />
        </div>
      </div>

      <style>{`@keyframes splashbar{0%{transform:translateX(-110%)}100%{transform:translateX(320%)}}`}</style>
    </div>
  );
}
