
-- campaigns: prevent changing user_id
DROP POLICY IF EXISTS "update own or staff" ON public.campaigns;
CREATE POLICY "update own or staff" ON public.campaigns
FOR UPDATE
USING ((user_id = auth.uid()) OR private.has_permission(auth.uid(), 'view_all_campaigns'::app_permission))
WITH CHECK ((user_id = auth.uid()) OR private.has_permission(auth.uid(), 'view_all_campaigns'::app_permission));

-- profiles: prevent changing id
DROP POLICY IF EXISTS "update own or admin" ON public.profiles;
CREATE POLICY "update own or admin" ON public.profiles
FOR UPDATE
USING ((id = auth.uid()) OR private.has_permission(auth.uid(), 'manage_users'::app_permission))
WITH CHECK ((id = auth.uid()) OR private.has_permission(auth.uid(), 'manage_users'::app_permission));

-- short_links
DROP POLICY IF EXISTS "owners update short links" ON public.short_links;
CREATE POLICY "owners update short links" ON public.short_links
FOR UPDATE
USING ((user_id = auth.uid()) OR private.has_permission(auth.uid(), 'view_shortener_admin'::app_permission))
WITH CHECK ((user_id = auth.uid()) OR private.has_permission(auth.uid(), 'view_shortener_admin'::app_permission));

-- short_link_urls
DROP POLICY IF EXISTS "owners update short link urls" ON public.short_link_urls;
CREATE POLICY "owners update short link urls" ON public.short_link_urls
FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.short_links sl WHERE sl.id = short_link_urls.short_link_id AND ((sl.user_id = auth.uid()) OR private.has_permission(auth.uid(), 'view_shortener_admin'::app_permission))))
WITH CHECK (EXISTS (SELECT 1 FROM public.short_links sl WHERE sl.id = short_link_urls.short_link_id AND ((sl.user_id = auth.uid()) OR private.has_permission(auth.uid(), 'view_shortener_admin'::app_permission))));

-- Revoke EXECUTE from public/anon/authenticated on SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_super_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_unique_slug_history() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_short_link_click(text) FROM PUBLIC, anon, authenticated;
