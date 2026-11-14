REVOKE ALL ON FUNCTION public.void_auction_refund(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.void_auction_refund(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.available_balance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.available_balance(uuid) TO authenticated, service_role;