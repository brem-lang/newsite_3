# Database

Self-hosted Supabase (`/opt/mazady-supabase/docker` on the server), served
through the site's own origin: Apache proxies `/auth/v1/`, `/rest/v1/` and
`/storage/v1/` to it.

`migrations/` rebuilds the schema on an empty instance, applied in filename
order. The 2026-08/09 files are the original schema; `20261114000000_self_hosted_setup.sql`
adapts it (safe sign-up roles, staff access check, image bucket, no demo data).

Grant staff access to an account (run as postgres):

    insert into public.user_roles (user_id, role) select id, 'admin' from auth.users where email = '...';
    update public.profiles set is_super = true, staff_role = 'super_admin' where email = '...';  -- optional
