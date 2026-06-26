REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.user_roles FROM anon;
REVOKE ALL ON public.user_permissions FROM anon;
REVOKE ALL ON public.credit_balances FROM anon;
REVOKE ALL ON public.credit_transactions FROM anon;
REVOKE ALL ON public.niches FROM anon;
REVOKE ALL ON public.client_pricing_overrides FROM anon;
REVOKE ALL ON public.message_templates FROM anon;
REVOKE ALL ON public.campaigns FROM anon;
REVOKE ALL ON public.campaign_files FROM anon;
REVOKE ALL ON public.short_links FROM anon;
REVOKE ALL ON public.short_link_urls FROM anon;
REVOKE ALL ON public.app_settings FROM anon;
REVOKE ALL ON public.wa_templates FROM anon;
REVOKE ALL ON public.campaign_deliveries FROM anon;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, public.app_permission) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_super_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, public.app_permission) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.protect_super_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.touch_updated_at() TO service_role;

DROP POLICY IF EXISTS "owners read short links" ON public.short_links;
DROP POLICY IF EXISTS "owners create short links" ON public.short_links;
DROP POLICY IF EXISTS "owners update short links" ON public.short_links;
DROP POLICY IF EXISTS "owners delete short links" ON public.short_links;
CREATE POLICY "owners read short links" ON public.short_links
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'view_shortener_admin'::public.app_permission));
CREATE POLICY "owners create short links" ON public.short_links
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "owners update short links" ON public.short_links
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'view_shortener_admin'::public.app_permission))
  WITH CHECK (user_id = auth.uid() OR public.has_permission(auth.uid(), 'view_shortener_admin'::public.app_permission));
CREATE POLICY "owners delete short links" ON public.short_links
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'view_shortener_admin'::public.app_permission));

DROP POLICY IF EXISTS "owners read short link urls" ON public.short_link_urls;
DROP POLICY IF EXISTS "owners create short link urls" ON public.short_link_urls;
DROP POLICY IF EXISTS "owners update short link urls" ON public.short_link_urls;
DROP POLICY IF EXISTS "owners delete short link urls" ON public.short_link_urls;
CREATE POLICY "owners read short link urls" ON public.short_link_urls
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.short_links sl
    WHERE sl.id = short_link_urls.short_link_id
      AND (sl.user_id = auth.uid() OR public.has_permission(auth.uid(), 'view_shortener_admin'::public.app_permission))
  ));
CREATE POLICY "owners create short link urls" ON public.short_link_urls
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.short_links sl
    WHERE sl.id = short_link_urls.short_link_id
      AND (sl.user_id = auth.uid() OR public.has_permission(auth.uid(), 'view_shortener_admin'::public.app_permission))
  ));
CREATE POLICY "owners update short link urls" ON public.short_link_urls
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.short_links sl
    WHERE sl.id = short_link_urls.short_link_id
      AND (sl.user_id = auth.uid() OR public.has_permission(auth.uid(), 'view_shortener_admin'::public.app_permission))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.short_links sl
    WHERE sl.id = short_link_urls.short_link_id
      AND (sl.user_id = auth.uid() OR public.has_permission(auth.uid(), 'view_shortener_admin'::public.app_permission))
  ));
CREATE POLICY "owners delete short link urls" ON public.short_link_urls
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.short_links sl
    WHERE sl.id = short_link_urls.short_link_id
      AND (sl.user_id = auth.uid() OR public.has_permission(auth.uid(), 'view_shortener_admin'::public.app_permission))
  ));