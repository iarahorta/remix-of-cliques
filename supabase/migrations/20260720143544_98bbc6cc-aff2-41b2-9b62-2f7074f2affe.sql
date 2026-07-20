REVOKE ALL ON FUNCTION public.get_partner_by_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_partner_by_token(text) TO service_role;