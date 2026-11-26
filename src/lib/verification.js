/**
 * Who has to wait for identity verification before joining or bidding.
 * Mirrors the server check in joinAuction / placeBid
 * (supabase/functions/api/handlers.ts): staff never need it, and a per-user
 * "allow" override for the action skips it too.
 */
export const isStaffUser = (user) => user?.role === "admin";

export function needsVerification(user, cap = "join_auctions") {
  if (!user || isStaffUser(user)) return false;
  if (user.is_verified || user.verification_status === "verified") return false;
  return user.permissions?.[cap] !== "allow";
}

/**
 * The status to show for a member (admin lists and the member's own account
 * page): staff are shown as "staff" (no verification needed) instead of
 * their stored "pending".
 */
export const displayVerification = (user, fallback = "pending") =>
  isStaffUser(user) ? "staff" : user?.verification_status || fallback;
