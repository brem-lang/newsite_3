/**
 * App bootstrap params.
 *
 * In the original Base44 hosting these came from URL query params persisted to
 * storage. Auth is now handled by the Supabase session, so this is
 * a thin, SSR-safe shim kept for the pages that still read it.
 */

const read = (key) => {
  if (typeof window === "undefined") return null;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get(key);
    if (fromUrl) {
      window.localStorage.setItem(`app_params_${key}`, fromUrl);
      return fromUrl;
    }
    return window.localStorage.getItem(`app_params_${key}`);
  } catch {
    return null;
  }
};

export const appParams = {
  get appId() {
    return read("app_id") || "mazady";
  },
  get token() {
    return read("access_token");
  },
  get fromUrl() {
    return read("from_url");
  },
};

export default appParams;
