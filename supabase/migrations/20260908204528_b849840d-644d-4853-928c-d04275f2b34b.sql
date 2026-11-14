-- 1. Deposits can never be credited twice for the same provider session.
DELETE FROM public.wallet_transactions a
USING public.wallet_transactions b
WHERE a.provider_txn_id IS NOT NULL
  AND a.provider_txn_id = b.provider_txn_id
  AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_provider_txn_uniq
  ON public.wallet_transactions (provider_txn_id)
  WHERE provider_txn_id IS NOT NULL;

-- 2. Authoritative wallet balance, computed in SQL over every row (no caps).
CREATE OR REPLACE FUNCTION public.wallet_confirmed_balance(_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(ROUND(SUM(amount)::numeric, 2), 0)
  FROM public.wallet_transactions
  WHERE user_id = _user_id
    AND COALESCE(status, '') NOT IN ('pending', 'failed');
$$;

REVOKE ALL ON FUNCTION public.wallet_confirmed_balance(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.wallet_confirmed_balance(uuid) TO authenticated, service_role;

-- 3. Exact per-round bid/number counts, computed in SQL (no 2k/5k row caps).
CREATE OR REPLACE FUNCTION public.auction_round_counts(_auction_id uuid, _round integer)
RETURNS TABLE (taken_count integer, cancelled_count integer, bid_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT amount)::int AS taken_count,
         COUNT(DISTINCT amount) FILTER (WHERE burned)::int AS cancelled_count,
         COUNT(*)::int AS bid_count
  FROM public.bids
  WHERE auction_id = _auction_id
    AND round = _round
    AND archived = false;
$$;

REVOKE ALL ON FUNCTION public.auction_round_counts(uuid, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.auction_round_counts(uuid, integer) TO authenticated, service_role;