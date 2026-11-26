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

/**
 * The homepage hero copy (admin → Hero). Desktop (SiteHero) and mobile
 * (MobileHome) both read it here, so the two never drift apart.
 */
export function heroCopy(content, t) {
  return {
    title: contentValue(content, "hero_title", null, t.home.heroTitle),
    subtitle: contentValue(content, "hero_subtitle", null, t.home.heroSubtitle),
  };
}

export function useHeroContent(t) {
  const { content, loading } = useContent();
  return { ...heroCopy(content, t), loading };
}
