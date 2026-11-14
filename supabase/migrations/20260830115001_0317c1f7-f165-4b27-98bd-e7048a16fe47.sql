CREATE OR REPLACE FUNCTION public.buy_bid_credits(_auction_id uuid, _user_id uuid, _count integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a public.auctions;
  price numeric;
  total numeric;
  bal numeric;
  newc integer;
begin
  if _count is null or _count < 1 then
    return jsonb_build_object('ok', false, 'error', 'invalid_count');
  end if;

  select * into a from public.auctions where id = _auction_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if a.mode <> 'closest' then
    return jsonb_build_object('ok', false, 'error', 'not_supported');
  end if;
  if a.status <> 'live' or a.end_time is null or now() >= a.end_time then
    return jsonb_build_object('ok', false, 'error', 'Auction ended');
  end if;
  if not (_user_id::text = any(a.subscriber_ids)) then
    return jsonb_build_object('ok', false, 'error', 'not_subscribed');
  end if;

  price := coalesce(a.extra_bid_price, 0);
  if price <= 0 then
    return jsonb_build_object('ok', false, 'error', 'extra_bids_disabled');
  end if;
  total := round(price * _count, 2);

  -- Serialize all wallet spending for this user, so concurrent purchases on
  -- different auctions cannot both pass the balance check and overdraw.
  perform pg_advisory_xact_lock(hashtextextended(_user_id::text, 0));

  select coalesce(round(sum(amount)::numeric, 2), 0) into bal
  from public.wallet_transactions
  where user_id = _user_id and status not in ('pending', 'failed');

  if bal < total then
    return jsonb_build_object('ok', false, 'error', 'insufficient_funds_for_credits', 'balance', bal, 'total', total);
  end if;

  insert into public.bid_credits (auction_id, user_id, round, credits)
  values (_auction_id, _user_id, coalesce(a.round, 1), _count)
  on conflict (auction_id, user_id, round)
  do update set credits = public.bid_credits.credits + excluded.credits
  returning credits into newc;

  insert into public.wallet_transactions (user_id, type, amount, description, auction_id, status)
  values (_user_id, 'bid_credits', -abs(total), _count || ' extra bids: ' || a.title, a.id, 'confirmed');

  return jsonb_build_object('ok', true, 'credits', newc, 'charged', total, 'price', price, 'balance', round(bal - total, 2));
end;
$function$;

REVOKE ALL ON FUNCTION public.buy_bid_credits(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buy_bid_credits(uuid, uuid, integer) TO service_role;