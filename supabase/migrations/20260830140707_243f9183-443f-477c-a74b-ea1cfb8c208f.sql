alter table public.auctions
  add column if not exists cost_price numeric not null default 0,
  add column if not exists other_cost numeric not null default 0;