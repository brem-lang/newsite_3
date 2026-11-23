import { useEffect, useRef } from "react";

/**
 * One scrollbar for the whole site that floats over the content instead of
 * taking up width. Native scrollbars are hidden in styles.css; this draws a
 * thin thumb on the edge of whichever area the mouse is over (the page itself
 * or any panel that scrolls vertically), only while the mouse is over it. The
 * thumb can be dragged. Touch screens keep their own scroll indicators, so
 * nothing is drawn for touch.
 */
const SIZE = 6; // thumb width, px
const INSET = 2; // gap from the area's edge, px
const MIN_THUMB = 28;
const HIDE_AFTER = 900; // ms after the last scroll or pointer move
// Layers that open above the nav (dialogs, sheets, drawers, popovers, menus).
const OVERLAY_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper], [data-vaul-drawer]';

function isScrollable(el) {
  if (!el || el.nodeType !== 1) return false;
  if (el.scrollHeight - el.clientHeight < 2) return false;
  // Areas that deliberately hide their scrollbar stay that way.
  if (el.classList.contains("no-scrollbar")) return false;
  const oy = getComputedStyle(el).overflowY;
  return oy === "auto" || oy === "scroll";
}

function scrollAreaAt(target) {
  for (let el = target; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    if (isScrollable(el)) return el;
  }
  const root = document.scrollingElement || document.documentElement;
  return root.scrollHeight - root.clientHeight > 1 ? root : null;
}

export default function OverlayScrollbar() {
  const thumbRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const thumb = thumbRef.current;
    if (!thumb) return;

    const root = document.scrollingElement || document.documentElement;
    let area = null; // element whose scrollbar is shown
    let lastTarget = null;
    let hideTimer = 0;
    let raf = 0;
    let drag = null; // { startY, startScroll, ratio }

    const place = () => {
      raf = 0;
      if (!area || !area.isConnected) return hide();
      const isRoot = area === root;
      const rect = isRoot
        ? { top: 0, left: 0, right: window.innerWidth, height: window.innerHeight }
        : area.getBoundingClientRect();
      const viewH = isRoot ? window.innerHeight : area.clientHeight;
      const total = area.scrollHeight;
      if (total - viewH < 2) return hide();

      const track = rect.height - INSET * 2;
      const h = Math.max(MIN_THUMB, (viewH / total) * track);
      const maxScroll = total - viewH;
      const top = rect.top + INSET + (area.scrollTop / maxScroll) * (track - h);
      const rtl = getComputedStyle(area).direction === "rtl";
      const x = rtl ? rect.left + INSET : rect.right - SIZE - INSET;

      thumb.style.transform = `translate(${Math.round(x)}px, ${Math.round(top)}px)`;
      thumb.style.height = `${Math.round(h)}px`;
      // Behind the sticky nav and bottom tab bar (z-40) for the page and its
      // panels; on top for areas inside dialogs, sheets and popovers.
      const overlay = !isRoot && area.closest(OVERLAY_SELECTOR);
      thumb.style.zIndex = overlay ? "2147483000" : "30";
      thumb.style.opacity = "1";
      thumb.style.pointerEvents = "auto";
      thumb.dataset.ratio = String(maxScroll / Math.max(1, track - h));
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(place);
    };

    const hide = () => {
      if (drag) return;
      thumb.style.opacity = "0";
      // A hidden thumb must not swallow clicks on what's under it.
      thumb.style.pointerEvents = "none";
    };

    const keepAlive = () => {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hide, HIDE_AFTER);
    };

    const onPointerMove = (e) => {
      if (e.pointerType === "touch" || drag) return;
      if (e.target === thumb) {
        clearTimeout(hideTimer);
        return;
      }
      // Only look the area up again when the pointer is over a new element.
      const next = e.target === lastTarget ? area : scrollAreaAt(e.target);
      lastTarget = e.target;
      if (!next) {
        area = null;
        return hide();
      }
      area = next;
      schedule();
      keepAlive();
    };

    const onScroll = (e) => {
      const el = e.target === document ? root : e.target;
      if (el !== area) return;
      schedule();
      keepAlive();
    };

    const onThumbDown = (e) => {
      if (!area) return;
      e.preventDefault();
      thumb.setPointerCapture(e.pointerId);
      drag = { startY: e.clientY, startScroll: area.scrollTop, ratio: Number(thumb.dataset.ratio) || 1 };
      thumb.dataset.dragging = "true";
      clearTimeout(hideTimer);
    };
    const onThumbMove = (e) => {
      if (!drag || !area) return;
      area.scrollTop = drag.startScroll + (e.clientY - drag.startY) * drag.ratio;
    };
    const onThumbUp = (e) => {
      if (!drag) return;
      drag = null;
      delete thumb.dataset.dragging;
      try { thumb.releasePointerCapture(e.pointerId); } catch {}
      keepAlive();
    };

    const onLeaveWindow = () => {
      if (!drag) hide();
    };

    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    document.documentElement.addEventListener("mouseleave", onLeaveWindow);
    thumb.addEventListener("pointerdown", onThumbDown);
    thumb.addEventListener("pointermove", onThumbMove);
    thumb.addEventListener("pointerup", onThumbUp);
    thumb.addEventListener("pointercancel", onThumbUp);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(hideTimer);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", schedule);
      document.documentElement.removeEventListener("mouseleave", onLeaveWindow);
      thumb.removeEventListener("pointerdown", onThumbDown);
      thumb.removeEventListener("pointermove", onThumbMove);
      thumb.removeEventListener("pointerup", onThumbUp);
      thumb.removeEventListener("pointercancel", onThumbUp);
    };
  }, []);

  return <div ref={thumbRef} className="overlay-scrollbar" aria-hidden="true" />;
}
