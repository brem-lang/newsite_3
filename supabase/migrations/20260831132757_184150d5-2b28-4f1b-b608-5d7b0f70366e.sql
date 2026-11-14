REVOKE ALL ON FUNCTION public.place_ascending_bid(uuid, uuid, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_ascending_bid(uuid, uuid, numeric, text) TO service_role;

REVOKE ALL ON FUNCTION public.place_closest_bid(uuid, uuid, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_closest_bid(uuid, uuid, numeric, text) TO service_role;

REVOKE ALL ON FUNCTION public.held_amount(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.held_amount(uuid) TO service_role;