import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { configQueries } from "@/lib/queries/config";
import { applyCachedTheme, rememberTheme, forgetTheme } from "@/lib/useSiteTheme";
import { applyTheme, syncThemeColorMeta } from "@/lib/themeDefaults";

// Applies the last known theme from local storage right away (no flash of the
// default colors), then the published theme from the cache/database, injected
// as CSS custom properties for the tailwind token classes.
export default function SiteThemeLoader() {
  const { data, isSuccess } = useQuery(configQueries.publishedTheme());
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // The theme applies to customer pages only. RootShell sets the attribute
  // for the first paint, but the prerendered shell is the "/" page, and React
  // does not correct <html> attributes during hydration, so a direct load of
  // /admin would keep it: set it here on every navigation as well.
  useEffect(() => {
    document.documentElement.toggleAttribute("data-site-theme", !/^\/admin(\/|$)/.test(pathname));
    // The browser toolbar follows the page background on customer pages only.
    syncThemeColorMeta();
  }, [pathname]);

  useEffect(() => {
    applyCachedTheme();
  }, []);

  useEffect(() => {
    if (!isSuccess) return;
    if (data?.theme) {
      applyTheme(data.theme);
      rememberTheme(data.theme);
    } else {
      // Every published version was deleted: back to the built-in look.
      applyTheme({});
      forgetTheme();
    }
  }, [data, isSuccess]);

  return null;
}
