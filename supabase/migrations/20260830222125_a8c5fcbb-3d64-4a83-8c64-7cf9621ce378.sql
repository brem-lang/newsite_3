REVOKE ALL ON FUNCTION public.protect_profile_columns() FROM authenticated, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated, anon;
REVOKE ALL ON FUNCTION public.touch_updated_date() FROM authenticated, anon;