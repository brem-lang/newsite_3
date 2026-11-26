import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { applyTheme } from "@/lib/themeDefaults";
import { configKeys } from "@/lib/queries/keys";

const list = (scope, sort = "-created_date", limit = 1) =>
  base44.entities.Theme.filter({ scope }, sort, limit).catch(() => []);

const THEME_CACHE_KEY = "site_theme_published";

/** Apply the last published theme saved in local storage, if any. */
export function applyCachedTheme() {
  try {
    const cached = localStorage.getItem(THEME_CACHE_KEY);
    if (cached) applyTheme(JSON.parse(cached));
  } catch {
    /* ignore unreadable cache */
  }
}

/** Save the published theme so the next visit paints with it immediately. */
export function rememberTheme(theme) {
  try {
    localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(theme));
  } catch {
    /* storage full or blocked */
  }
}

/** Drop the saved theme (nothing is published any more). */
export function forgetTheme() {
  try {
    localStorage.removeItem(THEME_CACHE_KEY);
  } catch {
    /* storage blocked */
  }
}

async function fetchEditorState() {
  const [d, p, h] = await Promise.all([
    list("draft"),
    list("published"),
    list("published", "-created_date", 8),
  ]);
  return { draft: d?.[0] || null, published: p?.[0] || null, history: h || [] };
}

const themeEditorQuery = () => ({
  queryKey: configKeys.themeEditor(),
  queryFn: fetchEditorState,
  staleTime: 30_000,
});

/** Route prefetch for the admin Design screen. */
export const prefetchSiteTheme = (qc) =>
  qc.ensureQueryData(themeEditorQuery()).catch(() => undefined);

/** Theme editor state for the admin Design screen. */
export function useSiteTheme() {
  const qc = useQueryClient();
  const { data, isPending } = useQuery(themeEditorQuery());
  const [saving, setSaving] = useState(false);
  const draftRef = useRef(null);

  // The latest saved draft, from the query or from our own last write.
  useEffect(() => {
    if (data) draftRef.current = data.draft;
  }, [data]);

  const setDraft = useCallback(
    (draft) => {
      draftRef.current = draft;
      qc.setQueryData(configKeys.themeEditor(), (prev) => (prev ? { ...prev, draft } : prev));
    },
    [qc],
  );

  const load = useCallback(
    () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: configKeys.themeEditor() }),
        qc.invalidateQueries({ queryKey: configKeys.publishedTheme() }),
      ]),
    [qc],
  );

  // Kept in refs (not state) so saveDraft's identity never changes. If it
  // depended on `saving`, every save would recreate it, re-trigger the caller's
  // debounce effect and save again — an endless PATCH /theme loop.
  const savingRef = useRef(false);
  const pendingRef = useRef(null);

  const writeDraft = useCallback(
    async (theme) => {
      if (draftRef.current) {
        setDraft(await base44.entities.Theme.update(draftRef.current.id, { theme }));
      } else {
        setDraft(await base44.entities.Theme.create({ scope: "draft", theme }));
      }
    },
    [setDraft],
  );

  const saveDraft = useCallback(
    async (theme) => {
      // Nothing changed since the last save: skip the request.
      if (draftRef.current && JSON.stringify(draftRef.current.theme) === JSON.stringify(theme))
        return;
      // A save is already in flight: remember only the latest edit and send it after.
      if (savingRef.current) {
        pendingRef.current = theme;
        return;
      }
      savingRef.current = true;
      setSaving(true);
      try {
        await writeDraft(theme);
      } catch {
        // ignore transient save errors; the next edit will retry
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
      const next = pendingRef.current;
      pendingRef.current = null;
      if (next) saveDraft(next);
    },
    [writeDraft],
  );

  // Publishing makes the theme live and removes the draft, so the editor,
  // the Draft/Published badge and the live site all agree afterwards.
  const publish = useCallback(
    async (theme) => {
      setSaving(true);
      pendingRef.current = null;
      try {
        await base44.entities.Theme.create({ scope: "published", theme });
        if (draftRef.current) {
          await base44.entities.Theme.delete(draftRef.current.id).catch(() => {});
          setDraft(null);
        }
        applyTheme(theme);
        rememberTheme(theme);
        await load();
      } finally {
        setSaving(false);
      }
    },
    [load, setDraft],
  );

  /** Delete one published version. If it was the live one, the next newest goes live. */
  const removeVersion = useCallback(
    async (id) => {
      setSaving(true);
      try {
        await base44.entities.Theme.delete(id);
        await load();
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  const discard = useCallback(async () => {
    if (draftRef.current) {
      await base44.entities.Theme.delete(draftRef.current.id).catch(() => {});
      draftRef.current = null;
    }
    await load();
  }, [load]);

  const restore = useCallback(
    async (theme) => {
      setSaving(true);
      try {
        await writeDraft(theme);
      } finally {
        setSaving(false);
      }
    },
    [writeDraft],
  );

  return {
    draft: data?.draft ?? null,
    published: data?.published ?? null,
    history: data?.history ?? [],
    loading: isPending,
    saving,
    saveDraft,
    publish,
    discard,
    restore,
    removeVersion,
    reload: load,
  };
}
