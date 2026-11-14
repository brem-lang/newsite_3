CREATE OR REPLACE FUNCTION public.join_auction_atomic(_auction_id uuid, _user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  a public.auctions;
  bal numeric;
  new_status text;
  new_start timestamptz;
  new_end timestamptz;
begin
  select * into a from public.auctions where id = _auction_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if a.status = 'ended' then
    return jsonb_build_object('ok', false, 'error', 'Auction ended');
  end if;

  if _user_id = any(a.subscriber_ids) then
    return jsonb_build_object('ok', false, 'error', 'already_joined');
  end if;

  -- NOTE: max_subscribers is the MINIMUM target that closes the round,
  -- not a cap. Any number of participants above it may join.

  select coalesce(round(sum(amount)::numeric, 2), 0) into bal
  from public.wallet_transactions
  where user_id = _user_id and status not in ('pending', 'failed');

  if bal < a.entry_fee then
    return jsonb_build_object('ok', false, 'error', 'insufficient_balance');
  end if;

  insert into public.wallet_transactions (user_id, type, amount, description, auction_id, status)
  values (_user_id, 'subscription', -abs(a.entry_fee), 'Entry fee: ' || a.title, a.id, 'confirmed');

  new_status := a.status;
  new_start := a.start_time;
  new_end := a.end_time;
  if a.status = 'open' and a.start_time is null then
    new_status := 'live';
    new_start := now();
    new_end := now() + make_interval(mins => a.duration_minutes);
  end if;

  update public.auctions
  set subscriber_ids = array_append(subscriber_ids, _user_id),
      status = new_status,
      start_time = new_start,
      end_time = new_end
  where id = a.id;

  return jsonb_build_object('ok', true, 'status', new_status);
end;
$$;
REVOKE ALL ON FUNCTION public.join_auction_atomic(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.join_auction_atomic(uuid, uuid) TO service_role;