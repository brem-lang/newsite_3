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
    const unsub = base44.entities.Content.subscribe(() => load());
    return unsub;
  }, [load]);

  return { content, loading };
}

// Resolve a content key, falling back to the provided default.
export function contentValue(content, key, _lang, fallback) {
  const item = content.find((c) => c.key === key);
  return item?.value_en || fallback;
}