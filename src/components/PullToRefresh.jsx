import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const THRESHOLD = 80;   // pull distance required to trigger a refresh
const MAX_PULL = 140;   // hard cap so the gesture never feels bottomless
const RESISTANCE = 0.5;
const INTENT = 28;      // dead-zone: the spinner stays hidden until the user pulls this far, so incidental scrolls don't flash it

/**
 * Pull-to-refresh wrapper for the mobile app shell.
 *
 * Works for both real scroll containers (scroll=true, the root is the
 * scroller and pull only engages when scrollTop === 0) and fixed
 * non-scrolling shells (scroll=false, pull is always available).
 *
 * The component owns the touch handling with non-passive listeners so it
 * can preventDefault during a pull and stop the page from rubber-banding.
 */
export default function PullToRefresh({
  onRefresh,
  children,
  className,
  innerClassName,
  scroll = true,
  disabled,
  ...rest
}) {
  const rootRef = useRef(null);
  const startY = useRef(null);
  const pulling = useRef(false);
  const pullRef = useRef(0);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const atTop = useCallback(() => {
    const el = rootRef.current;
    if (!el) return true;
    if (!scroll) return true; // fixed shell: never scrolls, always "at top"
    return el.scrollTop <= 0;
  }, [scroll]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || disabled) return;

    const onTouchStart = (e) => {
      if (refreshing) return;
      if (!atTop()) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0].clientY;
      pulling.current = false;
    };

    const onTouchMove = (e) => {
      if (startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        if (pulling.current) {
          pulling.current = false;
          pullRef.current = 0;
          setPull(0);
        }
        return;
      }
      if (!atTop()) {
        startY.current = null;
        pulling.current = false;
        pullRef.current = 0;
        setPull(0);
        return;
      }
      pulling.current = true;
      e.preventDefault();
      const next = Math.min(MAX_PULL, dy * RESISTANCE);
      pullRef.current = next;
      setPull(next);
    };

    const onTouchEnd = async () => {
      if (!pulling.current) {
        startY.current = null;
        return;
      }
      pulling.current = false;
      startY.current = null;
      if (pullRef.current >= THRESHOLD) {
        pullRef.current = THRESHOLD;
        setPull(THRESHOLD);
        setRefreshing(true);
        try {
          await onRefresh?.();
        } finally {
          setRefreshing(false);
          pullRef.current = 0;
          setPull(0);
        }
      } else {
        pullRef.current = 0;
        setPull(0);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [atTop, disabled, onRefresh, refreshing, scroll]);

  const progress = Math.min(1, pull / THRESHOLD);
  const moving = pulling.current;
  // Spinner stays invisible inside the intent dead-zone, then fades in
  // quickly once the user crosses it — so minor scrolls never flash it.
  const spinOpacity = refreshing
    ? 1
    : pull > INTENT
      ? Math.min(1, (pull - INTENT) / 18)
      : 0;

  return (
    <div
      ref={rootRef}
      {...rest}
      className={cn("relative", scroll ? "overflow-y-auto" : "overflow-hidden", className)}
      style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
    >
      {/* indicator — small, pinned inside the header band */}
      <div
        aria-hidden={spinOpacity === 0}
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center"
      >
        <div
          className="mt-2 flex items-center justify-center w-7 h-7 rounded-full bg-card border border-border shadow-md"
          style={{
            opacity: spinOpacity,
            transition: moving ? "none" : "opacity 0.2s ease",
          }}
        >
          {refreshing ? (
            <Loader2 className="w-4 h-4 text-accent animate-spin" />
          ) : (
            <RefreshCw
              className={cn(
                "transition-colors duration-200",
                progress >= 1 ? "text-accent" : "text-muted-foreground"
              )}
              style={{ transform: `rotate(${progress * 180}deg)` }}
            />
          )}
        </div>
      </div>

      {/* content */}
      <div
        className={innerClassName}
        style={{
          transform: `translateY(${pull}px)`,
          transition: moving ? "none" : "transform 0.25s ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}
