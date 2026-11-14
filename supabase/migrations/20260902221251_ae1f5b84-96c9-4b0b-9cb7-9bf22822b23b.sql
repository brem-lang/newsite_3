-- 1. Role hierarchy on the existing roles table
ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 10;

UPDATE public.roles SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '_', 'g')) WHERE slug IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS roles_slug_key ON public.roles (slug);

-- 2. Capability catalog
CREATE TABLE IF NOT EXISTS public.admin_capabilities (
  key text PRIMARY KEY,
  label text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  description text,
  min_level integer NOT NULL DEFAULT 50,
  sort_order integer NOT NULL DEFAULT 0,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_capabilities TO authenticated;
GRANT ALL ON public.admin_capabilities TO service_role;
ALTER TABLE public.admin_capabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read capabilities" ON public.admin_capabilities
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_admin_capabilities BEFORE UPDATE ON public.admin_capabilities
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_date();

-- 3. Per-role capability grants
CREATE TABLE IF NOT EXISTS public.role_capabilities (
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  capability_key text NOT NULL REFERENCES public.admin_capabilities(key) ON DELETE CASCADE,
  allowed boolean NOT NULL DEFAULT true,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, capability_key)
);
GRANT SELECT ON public.role_capabilities TO authenticated;
GRANT ALL ON public.role_capabilities TO service_role;
ALTER TABLE public.role_capabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read role capabilities" ON public.role_capabilities
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_role_capabilities BEFORE UPDATE ON public.role_capabilities
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_date();

-- 4. Seed the capability catalog
INSERT INTO public.admin_capabilities (key, label, category, min_level, sort_order) VALUES
  ('dashboard.view',    'View admin dashboard',      'overview', 10, 10),
  ('auctions.manage',   'Create and edit auctions',  'auctions', 50, 20),
  ('auctions.void',     'Cancel and refund auctions','auctions', 80, 30),
  ('auctions.testmode', 'Use test mode',             'auctions', 80, 40),
  ('credits.grant',     'Grant free bids',           'auctions', 50, 50),
  ('users.view',        'View users and participants','users',    10, 60),
  ('users.edit',        'Edit user details',         'users',    50, 70),
  ('users.verify',      'Approve verifications',     'users',    50, 80),
  ('users.suspend',     'Suspend or resume users',   'users',    80, 90),
  ('users.delete',      'Delete users',              'users',   100, 100),
  ('users.invite',      'Invite staff',              'users',   100, 110),
  ('finance.view',      'View finance and revenue',  'finance',  50, 120),
  ('payments.approve',  'Approve deposits',          'finance',  50, 130),
  ('refunds.resolve',   'Approve or reject refunds', 'finance',  50, 140),
  ('winners.manage',    'Manage winner payments',    'finance',  50, 150),
  ('fulfilment.manage', 'Manage fulfilment',         'ops',      40, 160),
  ('messaging.send',    'Send emails and broadcasts','ops',      40, 170),
  ('support.manage',    'Handle support tickets',    'ops',      30, 180),
  ('roles.manage',      'Manage roles and access',   'system',  100, 190),
  ('system.manage',     'Change system settings',    'system',  100, 200)
ON CONFLICT (key) DO UPDATE
  SET label = excluded.label, category = excluded.category,
      min_level = excluded.min_level, sort_order = excluded.sort_order;

-- 5. Seed the built-in role hierarchy
INSERT INTO public.roles (name, slug, level, description, is_system, permissions) VALUES
  ('Super admin',     'super_admin', 100, 'Full, unrestricted access.',                 true, '{}'::jsonb),
  ('Admin',           'admin',        80, 'Runs day-to-day operations.',                true, '{}'::jsonb),
  ('Finance manager', 'finance',      50, 'Money: deposits, refunds, winner payments.', true, '{}'::jsonb),
  ('Moderator',       'moderator',    40, 'Auctions, fulfilment and messaging.',        true, '{}'::jsonb),
  ('Support agent',   'support',      30, 'Support tickets and read-only views.',       true, '{}'::jsonb),
  ('Viewer',          'viewer',       10, 'Read-only dashboards.',                      true, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE
  SET level = excluded.level, is_system = true,
      description = coalesce(public.roles.description, excluded.description);

-- 6. Default grants: every role gets the capabilities at or below its level
INSERT INTO public.role_capabilities (role_id, capability_key, allowed)
SELECT r.id, c.key, true
FROM public.roles r
JOIN public.admin_capabilities c ON c.min_level <= r.level
WHERE r.is_system = true
ON CONFLICT (role_id, capability_key) DO NOTHING;

-- 7. Single source of truth for "may this staff member do X?"
CREATE OR REPLACE FUNCTION public.has_admin_capability(_user_id uuid, _key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  p public.profiles;
  r public.roles;
  granted boolean;
begin
  if _user_id is null then
    return false;
  end if;

  select * into p from public.profiles where id = _user_id;
  if not found then
    return false;
  end if;
  if coalesce(p.is_super, false) then
    return true;
  end if;
  if not public.has_role(_user_id, 'admin') then
    return false;
  end if;

  -- No named staff role: the built-in admin role applies.
  select * into r from public.roles
  where slug = coalesce(nullif(p.staff_role, ''), 'admin')
     or name = coalesce(nullif(p.staff_role, ''), 'admin')
  order by (slug = coalesce(nullif(p.staff_role, ''), 'admin')) desc
  limit 1;

  if not found then
    return true; -- unknown role name behaves like the built-in admin
  end if;

  select rc.allowed into granted
  from public.role_capabilities rc
  where rc.role_id = r.id and rc.capability_key = _key;

  if granted is not null then
    return granted;
  end if;

  return exists (
    select 1 from public.admin_capabilities c
    where c.key = _key and c.min_level <= r.level
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.my_admin_capabilities()
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select coalesce(array_agg(c.key order by c.sort_order), '{}')
  from public.admin_capabilities c
  where public.has_admin_capability(auth.uid(), c.key);
$function$;