REVOKE ALL ON FUNCTION public.place_closest_bid(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.place_ascending_bid(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bid_rate_status(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_closest_bid(uuid, uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.place_ascending_bid(uuid, uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.bid_rate_status(uuid, uuid) TO service_role;