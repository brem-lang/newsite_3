revoke execute on function public.place_ascending_bid(uuid, uuid, numeric, text) from anon, authenticated;
revoke execute on function public.buy_bid_credits(uuid, uuid, integer) from anon, authenticated;
grant execute on function public.place_ascending_bid(uuid, uuid, numeric, text) to service_role;
grant execute on function public.buy_bid_credits(uuid, uuid, integer) to service_role;