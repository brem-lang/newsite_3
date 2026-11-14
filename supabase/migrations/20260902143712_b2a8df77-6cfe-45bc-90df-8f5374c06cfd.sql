-- 1. Money: only admins may write wallet rows directly. Users' deposits go
--    through the backend topup handler (service role).
drop policy if exists "wallet_transactions create own or admin" on public.wallet_transactions;
create policy "wallet_transactions admin insert" on public.wallet_transactions
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

-- 2. Bids are only ever written by the bidding functions (service role) or an
--    admin. A direct client insert bypassed quota, fees, burn and rate limits.
drop policy if exists "bids insert own" on public.bids;

-- 3. Sealed ("closest to the price") rounds must not leak other participants'
--    numbers while the round is running. Burned numbers stay public.
drop policy if exists "bids read authenticated" on public.bids;
create policy "bids read authenticated" on public.bids
  for select to authenticated
  using (
    user_id = auth.uid()
    or burned = true
    or public.has_role(auth.uid(), 'admin')
    or exists (
      select 1 from public.auctions a
      where a.id = bids.auction_id
        and (coalesce(a.mode, 'ascending') <> 'closest' or a.status <> 'live')
    )
  );

-- 4. Chat is per auction: only participants (and admins) read a room.
drop policy if exists "auction messages read authenticated" on public.auction_messages;
create policy "auction messages read participants" on public.auction_messages
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_role(auth.uid(), 'admin')
    or exists (
      select 1 from public.auctions a
      where a.id = auction_messages.auction_id
        and auth.uid()::text = any(a.subscriber_ids)
    )
  );

-- 5. Balance helpers take an arbitrary user id, so signed-in users could read
--    anyone's wallet. Server code uses the service role.
revoke execute on function public.available_balance(uuid) from authenticated, anon;

-- 6. A sealed round with no target price had a number pool of one, which ended
--    the round on the first bid. Reject the bid instead of closing the auction.
create or replace function public.place_closest_bid(_auction_id uuid, _user_id uuid, _amount numeric, _client_request_id text default null::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a public.auctions;
  target numeric;
  inc numeric;
  existing public.bids;
  dup public.bids;
  cents integer;
  fee numeric;
  bal numeric;
  base_quota integer;
  extra integer;
  quota integer;
  used integer;
  min_used integer;
  rate_lim integer;
  rate_win integer;
  rate_used integer;
  win_start timestamptz;
  retry_after integer;
  total_numbers bigint;
  used_numbers bigint;
  free_numbers bigint;
  free_ratio numeric;
  floor_numbers bigint;
  remaining_secs numeric;
  new_end timestamptz;
  guard_end timestamptz;
  min_mins integer;
  did_burn boolean := false;
begin
  if _client_request_id is not null then
    select * into dup from public.bids
    where auction_id = _auction_id and user_id = _user_id and client_request_id = _client_request_id
    limit 1;
    if found then
      return jsonb_build_object('ok', true, 'duplicate', true, 'burned', dup.burned);
    end if;
  end if;

  select * into a from public.auctions where id = _auction_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if a.status <> 'live' or a.end_time is null or now() >= a.end_time then
    return jsonb_build_object('ok', false, 'error', 'Auction ended');
  end if;
  if not (_user_id::text = any(a.subscriber_ids)) then
    return jsonb_build_object('ok', false, 'error', 'not_subscribed');
  end if;

  target := coalesce(a.target_price, 0);
  if target <= 0 then
    return jsonb_build_object('ok', false, 'error', 'no_target_price');
  end if;
  inc := coalesce(nullif(a.bid_increment, 0), 0.01);
  fee := coalesce(a.bid_fee, 0);
  base_quota := greatest(coalesce(a.bids_per_participant, 5), 1);

  select coalesce(credits, 0) into extra
  from public.bid_credits
  where auction_id = _auction_id and user_id = _user_id and round = coalesce(a.round, 1);
  extra := coalesce(extra, 0);
  quota := base_quota + extra;

  if _amount <= 0 or _amount > target then
    return jsonb_build_object('ok', false, 'error', 'out_of_range');
  end if;

  cents := round(_amount * 100);
  if abs(_amount * 100 - cents) > 0.000001 or cents < 1 then
    return jsonb_build_object('ok', false, 'error', 'bad_step');
  end if;

  select count(*) into used
  from public.bids
  where auction_id = _auction_id
    and round = coalesce(a.round, 1)
    and archived = false
    and user_id = _user_id;

  if used >= quota then
    return jsonb_build_object('ok', false, 'error', 'quota_reached', 'quota', quota, 'used', used,
      'extra_price', coalesce(a.extra_bid_price, 0));
  end if;

  rate_lim := coalesce(a.bid_rate_limit, 0);
  rate_win := greatest(coalesce(a.bid_rate_window_minutes, 10), 1);
  if rate_lim > 0 then
    win_start := public.bid_window_start(rate_win);
    select count(*) into rate_used
    from public.bids
    where auction_id = _auction_id
      and user_id = _user_id
      and archived = false
      and created_date >= win_start;
    if coalesce(rate_used, 0) >= rate_lim then
      retry_after := greatest(ceil(extract(epoch from (win_start + make_interval(mins => rate_win) - now())))::int, 1);
      return jsonb_build_object('ok', false, 'error', 'rate_limited',
        'limit', rate_lim, 'window_minutes', rate_win, 'retry_after', retry_after);
    end if;
  end if;

  if used > 0 and used < base_quota then
    select min(cnt) into min_used
    from (
      select (
        select count(*)
        from public.bids b
        where b.auction_id = _auction_id
          and b.round = coalesce(a.round, 1)
          and b.archived = false
          and b.user_id::text = s
      ) as cnt
      from unnest(a.subscriber_ids) as s
    ) t;

    if coalesce(min_used, 0) < used then
      return jsonb_build_object(
        'ok', false, 'error', 'waiting_for_others',
        'quota', quota, 'used', used, 'min_used', coalesce(min_used, 0)
      );
    end if;
  end if;

  if fee > 0 then
    select public.available_balance(_user_id) into bal;
    if bal < fee then
      return jsonb_build_object('ok', false, 'error', 'insufficient_funds_for_fee', 'balance', bal, 'fee', fee);
    end if;
  end if;

  select * into existing
  from public.bids
  where auction_id = _auction_id
    and round = coalesce(a.round, 1)
    and archived = false
    and amount = _amount
  order by burned desc, created_date asc
  limit 1;

  if found then
    if existing.burned then
      return jsonb_build_object('ok', false, 'error', 'number_burned');
    end if;
    if existing.user_id = _user_id then
      return jsonb_build_object('ok', false, 'error', 'duplicate_own');
    end if;

    update public.bids set burned = true, burned_at = now() where id = existing.id;
    insert into public.bids (auction_id, user_id, amount, round, burned, burned_at, client_request_id)
    values (_auction_id, _user_id, _amount, coalesce(a.round, 1), true, now(), _client_request_id);
    did_burn := true;
  else
    insert into public.bids (auction_id, user_id, amount, round, client_request_id)
    values (_auction_id, _user_id, _amount, coalesce(a.round, 1), _client_request_id);
  end if;

  if fee > 0 then
    insert into public.wallet_transactions (user_id, type, amount, description, auction_id, status)
    values (_user_id, 'bid_fee', -abs(fee), 'Bid fee: ' || a.title, a.id, 'confirmed');
  end if;

  total_numbers := greatest(round(target * 100)::bigint, 1);

  select count(distinct amount) into used_numbers
  from public.bids
  where auction_id = _auction_id
    and round = coalesce(a.round, 1)
    and archived = false;

  free_numbers := greatest(total_numbers - coalesce(used_numbers, 0), 0);
  free_ratio := free_numbers::numeric / total_numbers::numeric;
  floor_numbers := greatest(ceil(total_numbers * 0.05)::bigint, 3);
  new_end := a.end_time;

  if free_numbers <= floor_numbers then
    new_end := now();
  else
    remaining_secs := extract(epoch from (a.end_time - now()));
    if remaining_secs > 0 then
      new_end := now() + make_interval(secs => greatest(remaining_secs * free_ratio, 60));
      if new_end > a.end_time then
        new_end := a.end_time;
      end if;
    end if;
  end if;

  min_mins := greatest(coalesce(a.min_round_minutes, 0), 0);
  if min_mins > 0 and a.start_time is not null then
    guard_end := a.start_time + make_interval(mins => min_mins);
    if guard_end > a.end_time then
      guard_end := a.end_time;
    end if;
    if new_end < guard_end then
      new_end := guard_end;
    end if;
  end if;

  if new_end is distinct from a.end_time then
    update public.auctions set end_time = new_end where id = _auction_id;
  end if;

  return jsonb_build_object(
    'ok', true, 'burned', did_burn, 'fee', fee, 'quota', quota, 'used', used + 1,
    'total_numbers', total_numbers, 'free_numbers', free_numbers, 'end_time', new_end,
    'min_round_minutes', min_mins
  );
end;
$function$;