revoke execute on function public.bump_short_link_click(text) from public, anon, authenticated;
grant execute on function public.bump_short_link_click(text) to service_role;