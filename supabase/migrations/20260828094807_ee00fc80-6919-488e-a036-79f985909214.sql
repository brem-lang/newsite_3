alter table public.auctions
  add column if not exists mode text not null default 'highest',
  add column if not exists target_price numeric;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'auctions_mode_check') then
    alter table public.auctions add constraint auctions_mode_check check (mode in ('highest','closest'));
  end if;
end $$;

alter table public.bids
  add column if not exists burned boolean not null default false,
  add column if not exists burned_at timestamptz;

create index if not exists bids_auction_round_amount_idx on public.bids (auction_id, round, amount);

create or replace function public.place_closest_bid(_auction_id uuid, _user_id uuid, _amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.auctions;
  target numeric;
  inc numeric;
  existing public.bids;
  steps numeric;
begin
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
  inc := coalesce(nullif(a.bid_increment, 0), 0.01);

  if _amount <= 0 or (target > 0 and _amount > target) then
    return jsonb_build_object('ok', false, 'error', 'out_of_range');
  end if;

  steps := _amount / inc;
  if abs(steps - round(steps)) > 0.000001 then
    return jsonb_build_object('ok', false, 'error', 'bad_step');
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
    insert into public.bids (auction_id, user_id, amount, round, burned, burned_at)
    values (_auction_id, _user_id, _amount, coalesce(a.round, 1), true, now());
    return jsonb_build_object('ok', true, 'burned', true);
  end if;

  insert into public.bids (auction_id, user_id, amount, round)
  values (_auction_id, _user_id, _amount, coalesce(a.round, 1));
  return jsonb_build_object('ok', true, 'burned', false);
end;
$$;

revoke all on function public.place_closest_bid(uuid, uuid, numeric) from public;
grant execute on function public.place_closest_bid(uuid, uuid, numeric) to service_role;