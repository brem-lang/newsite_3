create or replace function public.admin_dashboard(_from timestamptz, _to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  entry_fees numeric := 0;
  bid_fees numeric := 0;
  extra_bids numeric := 0;
  winner_payment numeric := 0;
  refunds numeric := 0;
  deposits numeric := 0;
  product_cost numeric := 0;
  other_cost numeric := 0;
  item_cost numeric := 0;
  income numeric := 0;
  costs numeric := 0;
  live_auctions integer := 0;
  open_auctions integer := 0;
  ended_auctions integer := 0;
  unpaid_wins integer := 0;
  unpaid_amount numeric := 0;
  pending_verifications integer := 0;
  pending_topups integer := 0;
  open_tickets integer := 0;
  pending_refunds integer := 0;
  new_users integer := 0;
  bid_count integer := 0;
  seats integer := 0;
  series jsonb := '[]'::jsonb;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden';
  end if;

  select
    coalesce(sum(case when type = 'subscription' then abs(amount) else 0 end), 0),
    coalesce(sum(case when type = 'bid_fee' then abs(amount) else 0 end), 0),
    coalesce(sum(case when type = 'bid_credits' then abs(amount) else 0 end), 0),
    coalesce(sum(case when type = 'winning_bid' then abs(amount) else 0 end), 0),
    coalesce(sum(case when type = 'refund' then abs(amount) else 0 end), 0),
    coalesce(sum(case when type = 'topup' then abs(amount) else 0 end), 0)
  into entry_fees, bid_fees, extra_bids, winner_payment, refunds, deposits
  from public.wallet_transactions
  where status = 'confirmed' and created_date >= _from and created_date < _to;

  select
    coalesce(sum(case when (winner_id is not null or winner_name is not null) then cost_price else 0 end), 0),
    coalesce(sum(case when (winner_id is not null or winner_name is not null) then other_cost else 0 end), 0)
  into product_cost, other_cost
  from public.auctions
  where created_date >= _from and created_date < _to;

  select coalesce(sum(abs(ci.amount)), 0) into item_cost
  from public.auction_cost_items ci
  join public.auctions a on a.id = ci.auction_id
  where a.created_date >= _from and a.created_date < _to;

  income := entry_fees + bid_fees + extra_bids + winner_payment;
  costs := product_cost + other_cost + item_cost + refunds;

  select
    count(*) filter (where status = 'live'),
    count(*) filter (where status = 'open'),
    count(*) filter (where status = 'ended' and updated_date >= _from and updated_date < _to),
    coalesce(sum(coalesce(array_length(subscriber_ids, 1), 0)) filter (where created_date >= _from and created_date < _to), 0)
  into live_auctions, open_auctions, ended_auctions, seats
  from public.auctions;

  select count(*), coalesce(sum(amount), 0) into unpaid_wins, unpaid_amount
  from public.winner_payments where status <> 'paid';

  select count(*) into pending_verifications from public.profiles
  where coalesce(verification_status, 'pending') = 'pending';

  select count(*) into pending_topups from public.wallet_transactions
  where status = 'pending' and type = 'topup';

  select count(*) into open_tickets from public.support_tickets where status <> 'closed';

  select count(*) into pending_refunds from public.refund_requests where status = 'pending';

  select count(*) into new_users from public.profiles
  where created_date >= _from and created_date < _to;

  select count(*) into bid_count from public.bids
  where archived = false and created_date >= _from and created_date < _to;

  select coalesce(jsonb_agg(row_to_json(s) order by s.day), '[]'::jsonb) into series
  from (
    select
      d::date as day,
      coalesce((
        select sum(abs(w.amount)) from public.wallet_transactions w
        where w.status = 'confirmed'
          and w.type in ('subscription','bid_fee','bid_credits','winning_bid')
          and w.created_date >= d and w.created_date < d + interval '1 day'
      ), 0) as income,
      coalesce((
        select sum(abs(w.amount)) from public.wallet_transactions w
        where w.status = 'confirmed' and w.type = 'refund'
          and w.created_date >= d and w.created_date < d + interval '1 day'
      ), 0) as refunds,
      coalesce((
        select sum(abs(w.amount)) from public.wallet_transactions w
        where w.status = 'confirmed' and w.type = 'topup'
          and w.created_date >= d and w.created_date < d + interval '1 day'
      ), 0) as deposits,
      coalesce((
        select count(*) from public.bids b
        where b.archived = false and b.created_date >= d and b.created_date < d + interval '1 day'
      ), 0) as bids,
      coalesce((
        select count(*) from public.profiles p
        where p.created_date >= d and p.created_date < d + interval '1 day'
      ), 0) as users
    from generate_series(date_trunc('day', _from), date_trunc('day', _to - interval '1 second'), interval '1 day') as d
  ) s;

  return jsonb_build_object(
    'from', _from, 'to', _to,
    'entry_fees', round(entry_fees, 2),
    'bid_fees', round(bid_fees, 2),
    'extra_bids', round(extra_bids, 2),
    'winner_payment', round(winner_payment, 2),
    'refunds', round(refunds, 2),
    'deposits', round(deposits, 2),
    'income', round(income, 2),
    'product_cost', round(product_cost, 2),
    'other_cost', round(other_cost, 2),
    'item_cost', round(item_cost, 2),
    'costs', round(costs, 2),
    'net', round(income - costs, 2),
    'margin', case when income > 0 then round(((income - costs) / income) * 100, 1) else 0 end,
    'arpu', case when seats > 0 then round(income / seats, 2) else 0 end,
    'seats', seats,
    'live_auctions', live_auctions,
    'open_auctions', open_auctions,
    'ended_auctions', ended_auctions,
    'unpaid_wins', unpaid_wins,
    'unpaid_amount', round(unpaid_amount, 2),
    'pending_verifications', pending_verifications,
    'pending_topups', pending_topups,
    'open_tickets', open_tickets,
    'pending_refunds', pending_refunds,
    'new_users', new_users,
    'bids', bid_count,
    'series', series
  );
end;
$$;

grant execute on function public.admin_dashboard(timestamptz, timestamptz) to authenticated, service_role;