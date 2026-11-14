REVOKE EXECUTE ON FUNCTION public.place_closest_bid(uuid, uuid, numeric) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.place_ascending_bid(uuid, uuid, numeric) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.join_auction_atomic(uuid, uuid) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.place_closest_bid(uuid, uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.place_ascending_bid(uuid, uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.join_auction_atomic(uuid, uuid) TO service_role;