import { useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";

// Free, CORS-friendly geo endpoint that returns the visitor's real client IP + country.
const GEO_URL = "https://get.geojs.io/v1/ip/geo.json";

// Backfills the registration IP + country onto the signed-in user once, the first
// time they load the app with no value yet stored. Non-critical: silent on failure.
export function useSignupGeo(user) {
  const ran = useRef(false);
  useEffect(() => {
    if (!user || ran.current || user.ip) return;
    ran.current = true;
    (async () => {
      try {
        const res = await fetch(GEO_URL, { headers: { Accept: "application/json" } });
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.ip) return;
        await base44.auth.updateMe({ ip: data.ip, country: data.country || "" });
      } catch (_) { /* non-critical */ }
    })();
  }, [user]);
}