import { useEffect, useState } from "react";

const QUERY = "(max-width: 767px)";

/**
 * Single source of truth for "render the mobile app version".
 * SSR-safe: starts false on the server/first paint, then syncs after hydration.
 */
export function useIsMobileView() {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const sync = () => setMobile(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  return mobile;
}

export default useIsMobileView;
