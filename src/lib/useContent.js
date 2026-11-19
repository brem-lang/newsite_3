import { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";

// Fetches all editable site content records, with realtime updates.
export function useContent() {
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    base44.entities.Content.list(50)
      .then(setContent)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    // Apply the changed row instead of re-reading every content record.
    return base44.entities.Content.subscribe(
      (ev) => {
        const row = ev.data || {};
        if (!row.id) return;
        setContent((list) => {
          const rest = list.filter((c) => c.id !== row.id);
          if (ev.type === "delete") return rest;
          const existing = list.find((c) => c.id === row.id);
          return existing ? list.map((c) => (c.id === row.id ? { ...c, ...row } : c)) : [...rest, row];
        });
      },
      { onReconnect: load },
    );
  }, [load]);

  return { content, loading };
}

// Resolve a content key, falling back to the provided default.
export function contentValue(content, key, _lang, fallback) {
  const item = content.find((c) => c.key === key);
  return item?.value_en || fallback;
}