import { queryOptions, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { accountKeys } from "./keys";

/**
 * The signed-in profile as stored (watch list, verification, ...). AuthContext
 * holds the identity used for guards; this is the cache pages read when they
 * need fields that change while the session lasts.
 */
export const accountQueries = {
  me: () =>
    queryOptions({
      queryKey: accountKeys.me(),
      queryFn: () => base44.auth.me(),
      staleTime: 30_000,
    }),
};

export function useMe(enabled = true) {
  return useQuery({ ...accountQueries.me(), enabled });
}
