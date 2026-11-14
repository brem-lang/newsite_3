import { useEffect } from "react";
import { applyPublishedThemeOnce } from "@/lib/useSiteTheme";

// Fetches the published theme once on startup and injects it as CSS custom
// properties so the existing tailwind token classes + neon utilities pick it up.
export default function SiteThemeLoader() {
  useEffect(() => {
    applyPublishedThemeOnce();
  }, []);
  return null;
}