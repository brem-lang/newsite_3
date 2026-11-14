import { useCallback, useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { DEFAULT_THEME, applyTheme } from "@/lib/themeDefaults";

const list = (scope, sort = "-created_date", limit = 1) =>
  base44.entities.Theme.filter({ scope }, sort, limit).catch(() => []);

const THEME_CACHE_KEY = "site_theme_published";

// Applies the last known theme immediately from local storage so colors don't
// wait on a network round-trip, then refreshes from the database.
export async function applyPublishedThemeOnce() {
  try {
    const cached = localStorage.getItem(THEME_CACHE_KEY);
    if (cached) applyTheme(JSON.parse(cached));
  } catch {
    /* ignore unreadable cache */
  }
  try {
    const res = await list("published");
    if (res && res[0] && res[0].theme) {
      applyTheme(res[0].theme);
      try {
        localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(res[0].theme));
      } catch {
        /* storage full or blocked */
      }
    }
  } catch {
    /* fall back to built-in defaults */
  }
}


export function useSiteTheme() {
  const [draft, setDraft] = useState(null);
  const [published, setPublished] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const draftRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [d, p, h] = await Promise.all([list("draft"), list("published"), list("published", "-created_date", 8)]);
    draftRef.current = d && d[0] ? d[0] : null;
    setDraft(draftRef.current);
    setPublished(p && p[0] ? p[0] : null);
    setHistory(h || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveDraft = useCallback(async (theme) => {
    if (saving) return;
    setSaving(true);
    try {
      if (draftRef.current) {
        const updated = await base44.entities.Theme.update(draftRef.current.id, { theme });
        draftRef.current = updated;
        setDraft(updated);
      } else {
        const created = await base44.entities.Theme.create({ scope: "draft", theme });
        draftRef.current = created;
        setDraft(created);
      }
    } catch (e) {
      // ignore transient save errors; debounce will retry on next edit
    } finally {
      setSaving(false);
    }
  }, [saving]);

  const publish = useCallback(async (theme) => {
    setSaving(true);
    try {
      await base44.entities.Theme.create({ scope: "published", theme });
      await load();
      applyTheme(theme);
    } finally {
      setSaving(false);
    }
  }, [load]);

  const discard = useCallback(async () => {
    if (draftRef.current) {
      await base44.entities.Theme.delete(draftRef.current.id).catch(() => {});
      draftRef.current = null;
    }
    await load();
  }, [load]);

  const restore = useCallback(async (theme) => {
    setSaving(true);
    try {
      if (draftRef.current) {
        const updated = await base44.entities.Theme.update(draftRef.current.id, { theme });
        draftRef.current = updated;
        setDraft(updated);
      } else {
        const created = await base44.entities.Theme.create({ scope: "draft", theme });
        draftRef.current = created;
        setDraft(created);
      }
    } finally {
      setSaving(false);
    }
  }, []);

  return { draft, published, history, loading, saving, saveDraft, publish, discard, restore, reload: load };
}