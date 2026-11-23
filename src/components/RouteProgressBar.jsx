import React, { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

const SHOW_AFTER_MS = 150; // cached / fast navigations never flash the bar

/**
 * Thin bar across the top of the screen while a navigation's loaders run.
 * The current page stays on screen underneath (router defaultPendingMs is
 * Infinity), so this is the only loading indicator on in-app navigation.
 */
export default function RouteProgressBar() {
  const pending = useRouterState({ select: (s) => s.status === "pending" });
  // idle -> loading (creeps towards 80%) -> done (100%, fades) -> idle
  const [phase, setPhase] = useState("idle");
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    if (pending) {
      const show = setTimeout(() => setPhase("loading"), SHOW_AFTER_MS);
      return () => clearTimeout(show);
    }
    if (phaseRef.current !== "loading") return undefined;
    setPhase("done");
    const hide = setTimeout(() => setPhase("idle"), 400);
    return () => clearTimeout(hide);
  }, [pending]);

  const width = phase === "loading" ? "80%" : phase === "done" ? "100%" : "0%";
  const transition =
    phase === "loading"
      ? "width 8s cubic-bezier(0.1, 0.7, 0.2, 1)"
      : phase === "done"
        ? "width 200ms ease-out, opacity 200ms ease-out 200ms"
        : "none";

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
      role="progressbar"
      aria-label="Loading page"
      aria-hidden={phase === "idle"}
    >
      <div
        className="h-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]"
        style={{ width, opacity: phase === "done" ? 0 : phase === "idle" ? 0 : 1, transition }}
      />
    </div>
  );
}
