REVOKE ALL ON FUNCTION public.protect_profile_permissions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_profile_permissions() FROM anon;
REVOKE ALL ON FUNCTION public.protect_profile_permissions() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.protect_profile_permissions() TO service_role;