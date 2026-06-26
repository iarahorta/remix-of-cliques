ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_use_hygiene_tool boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.protect_profile_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.can_customize_profile_photo := OLD.can_customize_profile_photo;
    NEW.can_use_hygiene_tool := OLD.can_use_hygiene_tool;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_permissions_before_update ON public.profiles;
CREATE TRIGGER protect_profile_permissions_before_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_permissions();