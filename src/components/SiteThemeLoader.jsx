import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { configQueries } from "@/lib/queries/config";
import { applyCachedTheme, rememberTheme } from "@/lib/useSiteTheme";
import { applyTheme } from "@/lib/themeDefaults";

// Applies the last known theme from local storage right away (no flash of the
// default colors), then the published theme from the cache/database, injected
// as CSS custom properties for the tailwind token classes.
export default function SiteThemeLoader() {
  const { data } = useQuery(configQueries.publishedTheme());

  useEffect(() => {
    applyCachedTheme();
  }, []);

  useEffect(() => {
    if (!data?.theme) return;
    applyTheme(data.theme);
    rememberTheme(data.theme);
  }, [data]);

  return null;
}
