import { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";

// Computes the user's wallet balance from WalletTransaction records and keeps
// it in sync in real time, so charges (entry fees, winning bids) and top-ups
// appear without a manual page reload.
export function useWallet(userId) {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let active = true;
    if (!userId) return;
    setLoading(true);

    const load = () =>
      base44.entities.WalletTransaction.filter({ user_id: userId }, "-created_date", 200)
        .then((txns) => {
          if (!active) return;
          const rows = (txns || [])
            .slice()
            .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
          setTransactions(rows);
          const usable = rows.filter((x) => x.status !== "pending" && x.status !== "failed");
          setBalance(usable.reduce((sum, t) => sum + Number(t.amount || 0), 0));
        })
        .catch(() => {})
        .finally(() => active && setLoading(false));

    load();

    // Realtime: any new/updated transaction for this user recomputes the balance.
    let unsub;
    try {
      unsub = base44.entities.WalletTransaction.subscribe((ev) => {
        const row = ev?.data;
        if (row && row.user_id && row.user_id !== userId) return;
        load();
      });
    } catch (_) { /* realtime is a nicety, never fatal */ }

    // Safety net for missed events (e.g. tab was backgrounded).
    const poll = setInterval(load, 20000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);

    return () => {
      active = false;
      clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      try { if (typeof unsub === "function") unsub(); } catch (_) { /* noop */ }
    };
  }, [userId, refreshKey]);

  return { balance, transactions, loading, refresh };
}
