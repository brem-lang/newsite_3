create type public.app_role as enum ('admin','moderator','user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_date timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "read own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.profiles (
  id uuid primary key,
  email text,
  full_name text,
  phone text,
  is_super boolean not null default false,
  paused boolean not null default false,
  verification_status text not null default 'pending',
  verification_note text,
  ip text,
  country text,
  permissions jsonb not null default '{}'::jsonb,
  watched_auction_ids text[] not null default '{}',
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles read own or admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "profiles insert own" on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy "profiles update own or admin" on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "profiles delete admin" on public.profiles for delete to authenticated
  using (public.has_role(auth.uid(),'admin'));

create or replace function public.protect_profile_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.has_role(auth.uid(),'admin') then
    return new;
  end if;
  new.is_super := old.is_super;
  new.paused := old.paused;
  new.permissions := old.permissions;
  new.verification_note := old.verification_note;
  if old.verification_status = 'verified' then
    new.verification_status := old.verification_status;
  end if;
  return new;
end; $$;
create trigger protect_profile_columns before update on public.profiles
  for each row execute function public.protect_profile_columns();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_date()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_date = now(); return new; end; $$;

create table public.auctions (
  id uuid primary key default gen_random_uuid(),
  title text not null, description text, image_url text, category_id uuid, brand_id uuid,
  entry_fee numeric not null default 10, max_subscribers integer not null default 10,
  subscriber_ids text[] not null default '{}', start_price numeric not null default 0,
  current_price numeric not null default 0, bid_increment numeric not null default 1,
  duration_minutes integer not null default 10, status text not null default 'open',
  start_time timestamptz, scheduled_start_time timestamptz, end_time timestamptz,
  highest_bidder_id uuid, winner_id uuid, winner_notified boolean not null default false,
  paid boolean not null default false,
  created_by uuid, created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);
create table public.bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null, user_id uuid not null, amount numeric not null,
  created_by uuid, created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text, logo_url text, active boolean not null default true, sort_order integer not null default 0,
  created_by uuid, created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text, color text default '#3b82f6', icon text, description text,
  sort_order integer not null default 0, active boolean not null default true,
  created_by uuid, created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);
create table public.contents (
  id uuid primary key default gen_random_uuid(),
  key text not null, label text, value_en text, value_ar text,
  created_by uuid, created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null, title_en text, title_ar text, body_en text, body_ar text, published boolean not null default false,
  created_by uuid, created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null, type text not null default 'manual', provider text, logo text, instructions text,
  enabled boolean not null default true, display_order integer not null default 0,
  created_by uuid, created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);
create table public.shipping_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null, carrier text, zone text, rate_flat numeric not null default 0,
  rate_per_kg numeric not null default 0, estimated_days integer not null default 0, active boolean not null default true,
  created_by uuid, created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);
create table public.site_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null default 'global', site_name text, tagline text, timezone text default 'Asia/Jerusalem',
  contact_email text, maintenance_mode boolean not null default false, maintenance_message text, active_currency text default 'USD',
  created_by uuid, created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);
create table public.themes (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'draft', theme jsonb not null default '{}'::jsonb,
  created_by uuid, created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid, actor_name text, action text not null, target_type text, target_id text, details text,
  created_by uuid, created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null, key text not null, scopes text, active boolean not null default true, last_used timestamptz,
  created_by uuid, created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null, type text not null default 'percent', value numeric not null default 10,
  min_amount numeric not null default 0, max_uses integer not null default 100, uses integer not null default 0,
  active boolean not null default true, expires_at timestamptz, description text,
  created_by uuid, created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);
create table public.participant_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, author_id uuid, author_name text, body text not null,
  created_by uuid, created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);
create table public.payment_method_credentials (
  id uuid primary key default gen_random_uuid(),
  payment_method_id uuid not null, secret_key text, publishable_key text, webhook_secret text,
  created_by uuid, created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null, description text, permissions jsonb not null default '{}'::jsonb, is_system boolean not null default false,
  created_by uuid, created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  key text not null, channel text not null default 'email', subject text, body text, variables text, active boolean not null default true,
  created_by uuid, created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_name text, target_type text not null default 'auction', target_id text, target_title text,
  reason text not null, status text not null default 'open', resolution_note text,
  created_by uuid, created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);
create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, type text not null default 'topup', amount numeric not null, description text, notes text,
  auction_id uuid, status text not null default 'confirmed', payment_method_id uuid, reference text,
  provider text, provider_txn_id text,
  created_by uuid, created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);
create table public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, original_transaction_id uuid, reason text, status text not null default 'pending',
  admin_note text, refund_transaction_id uuid,
  created_by uuid, created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid, user_name text, user_email text, subject text not null, body text not null,
  category text not null default 'general', priority text not null default 'normal', status text not null default 'open',
  auction_id uuid, staff_reply text, replied_by_id uuid, replied_at timestamptz,
  created_by uuid, created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);
create table public.fulfilments (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null, winner_id uuid not null, method text not null default 'shipping',
  address_name text, address_phone text, address_line1 text, address_line2 text, address_city text,
  address_country text, address_zip text, pickup_notes text, carrier text, tracking_number text,
  status text not null default 'pending', notes text,
  created_by uuid, created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid, title text not null, body text, channel text not null default 'inapp',
  type text not null default 'info', recipient text, status text not null default 'sent',
  read boolean not null default false, auction_id uuid,
  created_by uuid, created_date timestamptz not null default now(), updated_date timestamptz not null default now()
);

do $$
declare
  t text;
  public_read text[] := array['auctions','bids','brands','categories','contents','pages','payment_methods','shipping_methods','site_settings','themes'];
  admin_only text[] := array['activity_logs','api_keys','coupons','participant_notes','payment_method_credentials','roles','templates'];
  owner_tables text[] := array['wallet_transactions','refund_requests','support_tickets'];
  all_tables text[];
begin
  all_tables := public_read || admin_only || owner_tables || array['reports','fulfilments','notifications'];
  foreach t in array all_tables loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create trigger touch_%I before update on public.%I for each row execute function public.touch_updated_date()', t, t);
  end loop;

  foreach t in array public_read loop
    execute format('grant select on public.%I to anon', t);
    execute format('create policy "%s public read" on public.%I for select using (true)', t, t);
    execute format('create policy "%s admin insert" on public.%I for insert to authenticated with check (public.has_role(auth.uid(),''admin''))', t, t);
    execute format('create policy "%s admin update" on public.%I for update to authenticated using (public.has_role(auth.uid(),''admin''))', t, t);
    execute format('create policy "%s admin delete" on public.%I for delete to authenticated using (public.has_role(auth.uid(),''admin''))', t, t);
  end loop;

  foreach t in array admin_only loop
    execute format('create policy "%s admin all" on public.%I for all to authenticated using (public.has_role(auth.uid(),''admin'')) with check (public.has_role(auth.uid(),''admin''))', t, t);
  end loop;

  foreach t in array owner_tables loop
    execute format('create policy "%s read own or admin" on public.%I for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),''admin''))', t, t);
    execute format('create policy "%s create own or admin" on public.%I for insert to authenticated with check (user_id = auth.uid() or public.has_role(auth.uid(),''admin''))', t, t);
    execute format('create policy "%s admin update" on public.%I for update to authenticated using (public.has_role(auth.uid(),''admin''))', t, t);
    execute format('create policy "%s admin delete" on public.%I for delete to authenticated using (public.has_role(auth.uid(),''admin''))', t, t);
  end loop;
end $$;

create policy "bids insert own" on public.bids for insert to authenticated
  with check (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create policy "reports admin read" on public.reports for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "reports create authenticated" on public.reports for insert to authenticated with check (true);
create policy "reports admin update" on public.reports for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "reports admin delete" on public.reports for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create policy "fulfilments read winner or admin" on public.fulfilments for select to authenticated
  using (winner_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "fulfilments create winner or admin" on public.fulfilments for insert to authenticated
  with check (winner_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "fulfilments admin update" on public.fulfilments for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "fulfilments admin delete" on public.fulfilments for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create policy "notifications read own admin or chat" on public.notifications for select to authenticated
  using (user_id = auth.uid() or type = 'chat' or public.has_role(auth.uid(),'admin'));
create policy "notifications create authenticated" on public.notifications for insert to authenticated with check (true);
create policy "notifications update own or admin" on public.notifications for update to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "notifications delete own or admin" on public.notifications for delete to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

alter publication supabase_realtime add table public.auctions;
alter publication supabase_realtime add table public.bids;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.site_settings;