import { useEffect, useRef } from "react";

/**
 * Attach native-feeling horizontal swipe detection to an element.
 *
 * Returns a ref to spread on the container. Vertical-dominant gestures are
 * ignored so normal scrolling and pull-to-refresh keep working, and swipes
 * that start inside a horizontal scroller (carousels) are skipped.
 */
export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 60, disabled } = {}) {
  const ref = useRef(null);
  const start = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;

    const insideScroller = (target) => {
      let node = target;
      while (node && node !== el) {
        if (node.scrollWidth > node.clientWidth + 4) {
          const style = getComputedStyle(node).overflowX;
          if (style === "auto" || style === "scroll") return true;
        }
        node = node.parentElement;
      }
      return false;
    };

    const onStart = (e) => {
      const tp = e.touches[0];
      if (insideScroller(e.target)) { start.current = null; return; }
      start.current = { x: tp.clientX, y: tp.clientY, t: Date.now() };
    };

    const onEnd = (e) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const tp = e.changedTouches?.[0];
      if (!tp) return;
      const dx = tp.clientX - s.x;
      const dy = tp.clientY - s.y;
      if (Math.abs(dx) < threshold) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.5) return; // vertical intent
      if (Date.now() - s.t > 800) return;            // too slow to be a flick
      if (dx < 0) onSwipeLeft?.();
      else onSwipeRight?.();
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
    };
  }, [onSwipeLeft, onSwipeRight, threshold, disabled]);

  return ref;
}

export default useSwipe;
