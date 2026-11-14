create or replace function public.join_auction_atomic(_auction_id uuid, _user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  if _user_id::text = any(a.subscriber_ids) then
    return jsonb_build_object('ok', false, 'error', 'already_joined');
  end if;

  if coalesce(array_length(a.subscriber_ids, 1), 0) >= a.max_subscribers then
    return jsonb_build_object('ok', false, 'error', 'seats_full');
  end if;

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
  set subscriber_ids = array_append(subscriber_ids, _user_id::text),
      status = new_status,
      start_time = new_start,
      end_time = new_end
  where id = a.id;

  return jsonb_build_object('ok', true, 'status', new_status);
end;
$function$;

revoke all on function public.join_auction_atomic(uuid, uuid) from public, anon, authenticated;
grant execute on function public.join_auction_atomic(uuid, uuid) to service_role;