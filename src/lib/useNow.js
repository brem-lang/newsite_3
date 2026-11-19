import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * One shared 1-second clock for every countdown on the page.
 *
 * Components that read it re-render once per second; nothing else does. The
 * timer runs only while something is listening and the tab is visible, and
 * jumps straight to the current time when the tab comes back.
 */
const listeners = new Set();
let now = Date.now();
let timer = null;

function emit() {
  now = Date.now();
  for (const l of listeners) l();
}

function start() {
  if (timer || typeof document === "undefined" || document.hidden) return;
  timer = setInterval(emit, 1000);
}

function stop() {
  clearInterval(timer);
  timer = null;
}

function onVisibility() {
  if (document.hidden) stop();
  else {
    emit();
    start();
  }
}

function subscribe(listener) {
  listeners.add(listener);
  if (listeners.size === 1) {
    document.addEventListener("visibilitychange", onVisibility);
    now = Date.now();
    start();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
}

const getSnapshot = () => now;
const getServerSnapshot = () => 0;

/** Current time in ms, updated once per second. Pass false to stop ticking. */
export function useNow(active = true) {
  const ticking = useSyncExternalStore(active ? subscribe : noopSubscribe, getSnapshot, getServerSnapshot);
  return active ? ticking : Date.now();
}

const noopSubscribe = () => () => {};

/**
 * Re-renders the caller when the wall clock passes `at` (ms), and not before.
 * For values that only change at one known moment, such as an auction's
 * status flipping when its end time arrives.
 */
export function useRerenderAt(at) {
  const [wakeups, bump] = useState(0);
  useEffect(() => {
    if (!at) return;
    const wait = at - Date.now();
    if (wait <= 0) return;
    // setTimeout overflows past ~24.8 days; a capped wait just re-arms on wake.
    const id = setTimeout(() => bump((n) => n + 1), Math.min(wait + 50, 2 ** 31 - 1));
    return () => clearTimeout(id);
  }, [at, wakeups]);
}
