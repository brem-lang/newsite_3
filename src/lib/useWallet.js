import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const usable = (t) => t.status !== "pending" && t.status !== "failed";

/** Balance summed in Postgres; falls back to summing in the browser until the
 *  my_wallet_balance migration has been applied. */
async function fetchBalance(userId) {
  try {
    const value = await base44.rpc("my_wallet_balance");
    if (value !== null && value !== undefined) return Number(value);
  } catch {
    /* function not deployed yet */
  }
  const rows = await base44.entities.WalletTransaction.filterFields(
    "amount, status",
    { user_id: userId },
  );
  return Math.round(rows.filter(usable).reduce((sum, t) => sum + Number(t.amount || 0), 0) * 100) / 100;
}

const fetchTransactions = (userId) =>
  base44.entities.WalletTransaction.filter({ user_id: userId }, "-created_date", 200);

/** One realtime channel per user, shared by every useWallet instance. */
function useWalletRealtime(userId, qc) {
  useEffect(() => {
    if (!userId) return;
    // cancelRefetch: false — several mounted hooks receive the same event, and
    // they should share the one request already in flight.
    const refresh = () => qc.invalidateQueries({ queryKey: ["wallet", userId] }, { cancelRefetch: false });
    return base44.entities.WalletTransaction.subscribe(refresh, {
      filter: `user_id=eq.${userId}`,
      onReconnect: refresh,
    });
  }, [userId, qc]);
}

/**
 * The user's wallet balance, kept live. Every component that calls this shares
 * one cached request, one realtime channel and one background poll.
 *
 * Pass `withTransactions` only on pages that list the history; everywhere else
 * just the balance is fetched.
 */
export function useWallet(userId, withTransactions = false) {
  const qc = useQueryClient();
  useWalletRealtime(userId, qc);

  const shared = {
    enabled: !!userId,
    staleTime: 15_000,
    refetchInterval: 60_000, // safety net for missed realtime events
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  };

  const balanceQuery = useQuery({
    queryKey: ["wallet", userId, "balance"],
    queryFn: () => fetchBalance(userId),
    ...shared,
  });

  const txQuery = useQuery({
    queryKey: ["wallet", userId, "transactions"],
    queryFn: () => fetchTransactions(userId),
    ...shared,
    enabled: !!userId && !!withTransactions,
  });

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["wallet", userId] });
  }, [qc, userId]);

  return {
    balance: balanceQuery.data ?? 0,
    transactions: txQuery.data ?? [],
    loading: withTransactions ? txQuery.isPending : balanceQuery.isPending,
    refresh,
  };
}
