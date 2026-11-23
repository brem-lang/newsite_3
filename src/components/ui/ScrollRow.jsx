import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A sideways row of cards. Phones swipe it; with a mouse (where a wheel can't
 * scroll sideways) arrow buttons show on hover at whichever ends still have
 * more cards. Works in RTL.
 */
export default function ScrollRow({ children, className, label, autoplay = false, speed = 28, arrows = true }) {
  const ref = useRef(null);
  const [ends, setEnds] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // scrollLeft runs negative in RTL; its magnitude works either way.
    const x = Math.abs(el.scrollLeft);
    const max = el.scrollWidth - el.clientWidth;
    setEnds({ start: x <= 2, end: x >= max - 2 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [measure]);

  // autoplay: drift toward the end at a steady pace and loop. The children
  // must repeat the list once, with `data-loop-start` on the first repeated
  // card; jumping back by that distance is then invisible. Pauses while the
  // pointer, a finger or keyboard focus is on the row, and for reduced motion.
  useEffect(() => {
    const el = ref.current;
    if (!autoplay || !el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let last = 0;
    let pos = Math.abs(el.scrollLeft); // kept as a float: scrollLeft rounds
    let paused = false;
    let resumeTimer = 0;
    const rtl = getComputedStyle(el).direction === "rtl";
    // Snapping would fight a scroll that moves a fraction of a pixel a frame.
    el.style.scrollSnapType = "none";
    el.style.scrollBehavior = "auto";

    const loopWidth = () => {
      const start = el.querySelector("[data-loop-start]");
      const first = el.firstElementChild;
      return start && first ? Math.abs(start.offsetLeft - first.offsetLeft) : 0;
    };

    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      const dt = last ? Math.min(64, now - last) : 0;
      last = now;
      if (paused || document.hidden) return;
      // The user scrolled it (arrows, swipe): carry on from there.
      if (Math.abs(Math.abs(el.scrollLeft) - pos) > 2) pos = Math.abs(el.scrollLeft);
      pos += (speed * dt) / 1000;
      const w = loopWidth();
      if (w > 0 && pos >= w) pos -= w;
      el.scrollLeft = rtl ? -pos : pos;
    };

    const pause = () => {
      clearTimeout(resumeTimer);
      paused = true;
    };
    const resumeSoon = (ms = 400) => {
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        pos = Math.abs(el.scrollLeft);
        last = 0;
        paused = false;
      }, ms);
    };
    const onPointerLeave = (e) => {
      if (e.pointerType !== "touch") resumeSoon();
    };
    const onTouchEnd = () => resumeSoon(2500);
    const onFocusOut = (e) => {
      if (!el.parentElement.contains(e.relatedTarget)) resumeSoon();
    };

    // Listen on the wrapper so hovering the arrows also pauses it.
    const box = el.parentElement;
    box.addEventListener("pointerenter", pause);
    box.addEventListener("pointerleave", onPointerLeave);
    box.addEventListener("touchstart", pause, { passive: true });
    box.addEventListener("touchend", onTouchEnd);
    box.addEventListener("focusin", pause);
    box.addEventListener("focusout", onFocusOut);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(resumeTimer);
      el.style.scrollSnapType = "";
      el.style.scrollBehavior = "";
      box.removeEventListener("pointerenter", pause);
      box.removeEventListener("pointerleave", onPointerLeave);
      box.removeEventListener("touchstart", pause);
      box.removeEventListener("touchend", onTouchEnd);
      box.removeEventListener("focusin", pause);
      box.removeEventListener("focusout", onFocusOut);
    };
  }, [autoplay, speed]);

  const go = (towardEnd) => {
    const el = ref.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    const step = el.clientWidth * 0.8 * (towardEnd ? 1 : -1);
    el.scrollBy({ left: rtl ? -step : step, behavior: "smooth" });
  };

  const arrow =
    "absolute top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-border bg-card/90 text-foreground opacity-0 shadow-md backdrop-blur transition-opacity hover:border-accent/50 hover:text-accent focus-visible:opacity-100 group-hover/row:opacity-100 [@media(hover:hover)]:grid";

  return (
    <div className="group/row relative min-w-0">
      <div ref={ref} className={cn("snap-carousel min-w-0", className)} aria-label={label}>
        {children}
      </div>
      {arrows && !ends.start ? (
        <button type="button" onClick={() => go(false)} className={cn(arrow, "start-1")} aria-label="Previous">
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </button>
      ) : null}
      {arrows && !ends.end ? (
        <button type="button" onClick={() => go(true)} className={cn(arrow, "end-1")} aria-label="Next">
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </button>
      ) : null}
    </div>
  );
}
