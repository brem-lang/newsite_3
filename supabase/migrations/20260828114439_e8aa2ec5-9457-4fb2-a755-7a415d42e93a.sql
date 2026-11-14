create or replace function public.place_ascending_bid(_auction_id uuid, _user_id uuid, _amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  a public.auctions;
  bal numeric;
  min_next numeric;
  prev_bidder uuid;
begin
  select * into a from public.auctions where id = _auction_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if a.status = 'ended' then
    return jsonb_build_object('ok', false, 'error', 'Auction ended');
  end if;
  if a.status <> 'live' or a.end_time is null then
    return jsonb_build_object('ok', false, 'error', 'not_live');
  end if;
  if now() >= a.end_time then
    return jsonb_build_object('ok', false, 'error', 'Auction ended');
  end if;
  if not (_user_id::text = any(a.subscriber_ids)) then
    return jsonb_build_object('ok', false, 'error', 'not_subscribed');
  end if;

  select coalesce(round(sum(amount)::numeric, 2), 0) into bal
  from public.wallet_transactions
  where user_id = _user_id and status not in ('pending', 'failed');

  if bal < _amount then
    return jsonb_build_object('ok', false, 'error', 'insufficient_funds_for_bid', 'balance', bal, 'amount', _amount);
  end if;

  min_next := coalesce(nullif(a.current_price, 0), a.start_price, 0) + coalesce(a.bid_increment, 0);
  if _amount < min_next then
    return jsonb_build_object('ok', false, 'error', 'tooLow', 'min_next', min_next);
  end if;

  prev_bidder := a.highest_bidder_id;

  insert into public.bids (auction_id, user_id, amount, round)
  values (_auction_id, _user_id, _amount, coalesce(a.round, 1));

  update public.auctions
  set current_price = _amount,
      highest_bidder_id = _user_id
  where id = _auction_id;

  return jsonb_build_object('ok', true, 'current_price', _amount, 'prev_bidder', prev_bidder);
end;
$function$;

revoke all on function public.place_ascending_bid(uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.place_ascending_bid(uuid, uuid, numeric) to service_role;

create index if not exists bids_auction_round_amount_idx
  on public.bids (auction_id, round, amount) where archived = false;
create index if not exists bids_auction_created_idx
  on public.bids (auction_id, created_date desc);
create index if not exists wallet_tx_user_status_idx
  on public.wallet_transactions (user_id, status);