ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS staff_role text;

CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
begin
  if auth.uid() is null or public.has_role(auth.uid(),'admin') then
    return new;
  end if;
  new.is_super := old.is_super;
  new.paused := old.paused;
  new.permissions := old.permissions;
  new.verification_note := old.verification_note;
  new.staff_role := old.staff_role;
  if old.verification_status = 'verified' then
    new.verification_status := old.verification_status;
  end if;
  return new;
end; $function$;