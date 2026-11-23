/**
 * Search-param parsers for routes (`validateSearch`). Each one accepts the raw
 * query object and returns only known, well-formed keys, so pages can trust
 * `route.useSearch()` without re-validating. Unknown values are dropped.
 */
type Raw = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]) =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;

export const AUCTION_TABS = ["all", "live", "open", "ended", "mine"] as const;
export const AUCTION_SORTS = ["newest", "ending", "priceLow", "priceHigh", "bids"] as const;

export type AuctionsSearch = {
  tab?: (typeof AUCTION_TABS)[number] | undefined;
  sort?: (typeof AUCTION_SORTS)[number] | undefined;
  q?: string | undefined;
  category?: string | undefined;
};

export function parseAuctionsSearch(raw: Raw): AuctionsSearch {
  return {
    tab: oneOf(raw["tab"], AUCTION_TABS),
    sort: oneOf(raw["sort"], AUCTION_SORTS),
    // Keep the raw search text (spaces included) while the user types.
    q: typeof raw["q"] === "string" && raw["q"] ? raw["q"] : undefined,
    category: str(raw["category"]),
  };
}

export type WalletSearch = { session_id?: string | undefined; method_id?: string | undefined };

/** Stripe checkout returns to /wallet?session_id=…&method_id=…. */
export function parseWalletSearch(raw: Raw): WalletSearch {
  return { session_id: str(raw["session_id"]), method_id: str(raw["method_id"]) };
}

export type ReturnToSearch = { returnTo?: string | undefined };

/** The destination is re-validated by safeReturnTo() before it is used. */
export function parseReturnToSearch(raw: Raw): ReturnToSearch {
  return { returnTo: str(raw["returnTo"]) };
}

export type ResetPasswordSearch = { token?: string | undefined; code?: string | undefined };

export function parseResetPasswordSearch(raw: Raw): ResetPasswordSearch {
  return { token: str(raw["token"]), code: str(raw["code"]) };
}
