import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


// SSR-safe: evaluated lazily on access, never at module scope.
export const isIframe = typeof window !== "undefined" && window.self !== window.top;
