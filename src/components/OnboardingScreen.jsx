import React, { useEffect, useMemo, useState } from "react";
import { Gavel, Wallet, Trophy, ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const KEY = "bidkita_onboarding_seen";
const SPLASH_KEY = "bidkita_splash_seen";

const COPY = {
  en: {
    skip: "Skip",
    next: "Next",
    start: "Get started",
    signin: "I have an account",
    browse: "Browse auctions",
    slides: [
      {
        title: "Live auctions",
        body: "Take a seat and watch the auction move in real time.",
      },
      {
        title: "Your wallet, your control",
        body: "Top up, track every move, and bid with nothing locked away.",
      },
      {
        title: "Closest price wins",
        body: "The closest unique number to the target takes it home. Simple and fair.",
      },
    ],
  },
};

const ICONS = [Gavel, Wallet, Trophy];

/**
 * Screen 02 — Onboarding. Three native-style slides shown once per device,
 * right after the splash screen.
 */
export default function OnboardingScreen() {
  const { dir } = useI18n();
  const copy = COPY.en;
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let seen = true;
    let splashSeen = true;
    try {
      seen = localStorage.getItem(KEY) === "1";
      splashSeen = sessionStorage.getItem(SPLASH_KEY) === "1";
    } catch {
      seen = true;
    }
    if (seen) return;
    // Visitors browse the home page first — the intro only appears once they
    // head to sign in or sign up, so nothing ever covers the landing screen.
    const path = typeof window !== "undefined" ? window.location.pathname : "/";
    if (path !== "/login" && path !== "/register") return;
    const delay = splashSeen ? 0 : 2600;
    const timer = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(timer);
  }, []);

  const navigate = useNavigate();

  const dismiss = (to) => {
    setLeaving(true);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      setShow(false);
      if (to) navigate({ to, replace: true });
    }, 300);
  };

  const slides = copy.slides;
  const last = step === slides.length - 1;
  const Icon = useMemo(() => ICONS[step] || Gavel, [step]);
  const NextIcon = ChevronRight;

  if (!show) return null;

  return (
    <div
      dir={dir}
      className={cn(
        "fixed inset-0 z-[95] flex flex-col overflow-hidden bg-background transition-opacity duration-300",
        leaving ? "opacity-0" : "opacity-100"
      )}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[30%] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]" />
        <div className="absolute left-1/2 top-[26%] h-[220px] w-[220px] -translate-x-1/2 rounded-full bg-primary/15 blur-[90px]" />
      </div>

      <div className="relative flex items-center justify-end px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => dismiss("/")}
          className="rounded-xl text-xs"
        >
          {copy.skip}
        </Button>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center px-8 text-center">
        <div className="relative grid h-36 w-36 place-items-center">
          <span className="absolute inset-0 rounded-full border border-accent/20" />
          <span className="absolute inset-5 rounded-full border border-primary/25 shadow-[0_0_60px_hsl(var(--primary)/0.2)]" />
          <Icon
            className="relative h-14 w-14 text-primary drop-shadow-[0_0_22px_hsl(var(--primary)/0.5)]"
            strokeWidth={1.6}
          />
        </div>

        <h2 className="mt-10 font-display text-2xl font-extrabold tracking-tight text-foreground">
          {slides[step].title}
        </h2>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
          {slides[step].body}
        </p>

        <div className="mt-8 flex items-center gap-2">
          {slides.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === step ? "w-6 bg-primary" : "w-1.5 bg-muted"
              )}
            />
          ))}
        </div>
      </div>

      <div className="relative w-full px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-sm space-y-3">
          {last ? (
            <>
              <Button asChild className="h-12 w-full gold-button text-base font-bold">
                <Link to="/register" onClick={() => dismiss()}>
                  {copy.start}
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 w-full text-base font-semibold">
                <Link to="/login" onClick={() => dismiss()}>
                  {copy.signin}
                </Link>
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => dismiss("/")}
                className="h-11 w-full text-sm font-semibold"
              >
                {copy.browse}
              </Button>
            </>
          ) : (
            <Button
              onClick={() => setStep((s) => s + 1)}
              className="h-12 w-full gold-button text-base font-bold"
            >
              {copy.next}
              <NextIcon className="ms-1 h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
