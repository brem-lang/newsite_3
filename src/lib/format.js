// Shared formatting helpers so the wallet log reads the same everywhere.

export function formatDateTime(value, locale) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  // Always Latin (English) digits, even in Arabic UI.
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatAmount(amount) {
  const n = Number(amount || 0);
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(2)}`;
}

export const TX_TYPES = ["topup", "subscription", "winning_bid", "refund"];
