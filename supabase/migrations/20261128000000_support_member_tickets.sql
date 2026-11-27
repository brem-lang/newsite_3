-- Member support tickets: members open tickets from /support, staff reply from
-- Admin → Support, and the member reads the reply under "My tickets".
-- Front end: src/pages/SupportPage.jsx, src/lib/queries/support.js,
-- src/components/admin/AdminSupport.jsx.

-- 1. Editable WhatsApp contact for /support (the email uses contact_email) --------
alter table public.site_settings add column if not exists support_whatsapp text;

-- 2. What a member may write -------------------------------------------------------
-- RLS already lets a member insert a ticket with their own user_id, and only
-- staff may update or delete. This trigger stops a crafted insert from setting
-- staff-only fields or someone else's name, checks the text, and limits each
-- member to 5 tickets an hour. Staff (and the service role) are left alone.
create or replace function public.support_ticket_member_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_recent int;
begin
  if v_uid is null or public.has_role(v_uid, 'admin') then
    return new;
  end if;

  new.user_id := v_uid;
  new.created_by := v_uid;
  select p.full_name, p.email into new.user_name, new.user_email
    from public.profiles p where p.id = v_uid;
  new.status := 'open';
  new.priority := 'normal';
  new.staff_reply := null;
  new.replied_by_id := null;
  new.replied_at := null;
  new.created_date := now();
  new.updated_date := now();

  new.subject := btrim(coalesce(new.subject, ''));
  new.body := btrim(coalesce(new.body, ''));
  if length(new.subject) = 0 or length(new.subject) > 150 then
    raise exception 'support_subject_invalid' using errcode = '22023';
  end if;
  if length(new.body) = 0 or length(new.body) > 5000 then
    raise exception 'support_body_invalid' using errcode = '22023';
  end if;
  if new.category is null or new.category not in ('general', 'dispute', 'payment', 'technical', 'other') then
    new.category := 'general';
  end if;
  if new.auction_id is not null and not exists (select 1 from public.auctions a where a.id = new.auction_id) then
    new.auction_id := null;
  end if;

  select count(*) into v_recent
    from public.support_tickets s
   where s.user_id = v_uid and s.created_date > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'support_rate_limited' using errcode = 'P0001';
  end if;

  return new;
end $$;

drop trigger if exists support_ticket_member_guard on public.support_tickets;
create trigger support_ticket_member_guard
  before insert on public.support_tickets
  for each row execute function public.support_ticket_member_guard();

create index if not exists support_tickets_user_created_idx
  on public.support_tickets (user_id, created_date desc);

-- 3. Live updates ---------------------------------------------------------------------
-- The staff inbox refreshes on new tickets; a member's "My tickets" shows a reply
-- without a reload. Realtime applies the table's RLS (own rows, or staff).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_tickets'
  ) then
    alter publication supabase_realtime add table public.support_tickets;
  end if;
end $$;
