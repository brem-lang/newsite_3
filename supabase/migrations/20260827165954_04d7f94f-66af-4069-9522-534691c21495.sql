REVOKE ALL ON FUNCTION public.join_auction_atomic(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_auction_atomic(uuid, uuid) TO service_role;