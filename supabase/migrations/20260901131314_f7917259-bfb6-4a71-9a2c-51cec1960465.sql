create or replace function public.admin_dashboard(_from timestamptz, _to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_entry_fees numeric := 0;
  v_bid_fees numeric := 0;
  v_extra_bids numeric := 0;
  v_winner_payment numeric := 0;
  v_refunds numeric := 0;
  v_deposits numeric := 0;
  v_product_cost numeric := 0;
  v_other_cost numeric := 0;
  v_item_cost numeric := 0;
  v_income numeric := 0;
  v_costs numeric := 0;
  v_live integer := 0;
  v_open integer := 0;
  v_ended integer := 0;
  v_unpaid integer := 0;
  v_unpaid_amount numeric := 0;
  v_pending_verifications integer := 0;
  v_pending_topups integer := 0;
  v_open_tickets integer := 0;
  v_pending_refunds integer := 0;
  v_new_users integer := 0;
  v_bids integer := 0;
  v_seats integer := 0;
  v_series jsonb := '[]'::jsonb;
begin
  perform public.admin_dashboard_guard();

  select
    coalesce(sum(case when w.type = 'subscription' then abs(w.amount) else 0 end), 0),
    coalesce(sum(case when w.type = 'bid_fee' then abs(w.amount) else 0 end), 0),
    coalesce(sum(case when w.type = 'bid_credits' then abs(w.amount) else 0 end), 0),
    coalesce(sum(case when w.type = 'winning_bid' then abs(w.amount) else 0 end), 0),
    coalesce(sum(case when w.type = 'refund' then abs(w.amount) else 0 end), 0),
    coalesce(sum(case when w.type in ('topup', 'deposit') then abs(w.amount) else 0 end), 0)
  into v_entry_fees, v_bid_fees, v_extra_bids, v_winner_payment, v_refunds, v_deposits
  from public.wallet_transactions w
  where w.status = 'confirmed' and w.created_date >= _from and w.created_date < _to;

  select
    coalesce(sum(case when (a.winner_id is not null or a.winner_name is not null) then a.cost_price else 0 end), 0),
    coalesce(sum(case when (a.winner_id is not null or a.winner_name is not null) then a.other_cost else 0 end), 0)
  into v_product_cost, v_other_cost
  from public.auctions a
  where a.created_date >= _from and a.created_date < _to;

  select coalesce(sum(abs(ci.amount)), 0) into v_item_cost
  from public.auction_cost_items ci
  join public.auctions a on a.id = ci.auction_id
  where a.created_date >= _from and a.created_date < _to;

  v_income := v_entry_fees + v_bid_fees + v_extra_bids + v_winner_payment;
  v_costs := v_product_cost + v_other_cost + v_item_cost + v_refunds;

  select
    count(*) filter (where a.status = 'live'),
    count(*) filter (where a.status = 'open'),
    count(*) filter (where a.status = 'ended' and a.updated_date >= _from and a.updated_date < _to),
    coalesce(sum(coalesce(array_length(a.subscriber_ids, 1), 0)) filter (where a.created_date >= _from and a.created_date < _to), 0)
  into v_live, v_open, v_ended, v_seats
  from public.auctions a;

  select count(*), coalesce(sum(wp.amount), 0) into v_unpaid, v_unpaid_amount
  from public.winner_payments wp where wp.status <> 'paid';

  select count(*) into v_pending_verifications from public.profiles p
  where coalesce(p.verification_status, 'pending') = 'pending';

  select count(*) into v_pending_topups from public.wallet_transactions w
  where w.status = 'pending' and w.type in ('topup', 'deposit');

  select count(*) into v_open_tickets from public.support_tickets s where s.status <> 'closed';

  select count(*) into v_pending_refunds from public.refund_requests r where r.status = 'pending';

  select count(*) into v_new_users from public.profiles p
  where p.created_date >= _from and p.created_date < _to;

  select count(*) into v_bids from public.bids b
  where b.archived = false and b.created_date >= _from and b.created_date < _to;

  select coalesce(jsonb_agg(row_to_json(s) order by s.day), '[]'::jsonb) into v_series
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
        where w.status = 'confirmed' and w.type in ('topup','deposit')
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
    'entry_fees', round(v_entry_fees, 2),
    'bid_fees', round(v_bid_fees, 2),
    'extra_bids', round(v_extra_bids, 2),
    'winner_payment', round(v_winner_payment, 2),
    'refunds', round(v_refunds, 2),
    'deposits', round(v_deposits, 2),
    'income', round(v_income, 2),
    'product_cost', round(v_product_cost, 2),
    'other_cost', round(v_other_cost, 2),
    'item_cost', round(v_item_cost, 2),
    'costs', round(v_costs, 2),
    'net', round(v_income - v_costs, 2),
    'margin', case when v_income > 0 then round(((v_income - v_costs) / v_income) * 100, 1) else 0 end,
    'arpu', case when v_seats > 0 then round(v_income / v_seats, 2) else 0 end,
    'seats', v_seats,
    'live_auctions', v_live,
    'open_auctions', v_open,
    'ended_auctions', v_ended,
    'unpaid_wins', v_unpaid,
    'unpaid_amount', round(v_unpaid_amount, 2),
    'pending_verifications', v_pending_verifications,
    'pending_topups', v_pending_topups,
    'open_tickets', v_open_tickets,
    'pending_refunds', v_pending_refunds,
    'new_users', v_new_users,
    'bids', v_bids,
    'series', v_series
  );
end;
$$;

revoke execute on function public.admin_dashboard(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_dashboard(timestamptz, timestamptz) to service_role;