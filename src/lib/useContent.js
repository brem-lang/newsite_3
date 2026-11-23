import { useContentQuery } from "@/lib/queries/config";

const EMPTY = [];

// All editable site content records, cached for the session and kept live by
// realtime (see src/lib/queries/config.js).
export function useContent() {
  const { data, isPending } = useContentQuery();
  return { content: data ?? EMPTY, loading: isPending };
}

// Resolve a content key, falling back to the provided default.
export function contentValue(content, key, _lang, fallback) {
  const item = content.find((c) => c.key === key);
  return item?.value_en || fallback;
}
