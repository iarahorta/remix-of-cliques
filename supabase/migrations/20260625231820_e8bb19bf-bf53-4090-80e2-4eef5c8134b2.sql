
-- Move SECURITY DEFINER helpers to a private schema so PostgREST does not expose them,
-- silencing the database linter. RLS policies continue to call them via the private schema.

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, anon, service_role;

-- Recreate helpers in private schema
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION private.has_permission(_user_id uuid, _perm public.app_permission)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    private.has_role(_user_id, 'admin')
    OR private.has_role(_user_id, 'super_admin')
    OR EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = _user_id AND permission = _perm)
$$;

CREATE OR REPLACE FUNCTION private.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id
    AND role IN ('admin','super_admin','operator','admin_jr'))
$$;

CREATE OR REPLACE FUNCTION private.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin')
$$;

GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.has_permission(uuid, public.app_permission) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.is_staff(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.is_super_admin(uuid) TO authenticated, anon;

-- Recreate all policies referencing the public helpers to use the private ones.

-- profiles
DROP POLICY IF EXISTS "admin updates any profile" ON public.profiles;
CREATE POLICY "admin updates any profile" ON public.profiles FOR UPDATE TO authenticated
  USING (private.has_permission(auth.uid(), 'manage_users'))
  WITH CHECK (private.has_permission(auth.uid(), 'manage_users'));

DROP POLICY IF EXISTS "update own or admin" ON public.profiles;
CREATE POLICY "update own or admin" ON public.profiles FOR UPDATE TO authenticated
  USING ((id = auth.uid()) OR private.has_permission(auth.uid(), 'manage_users'));

DROP POLICY IF EXISTS "view own or staff" ON public.profiles;
CREATE POLICY "view own or staff" ON public.profiles FOR SELECT TO authenticated
  USING ((id = auth.uid()) OR private.has_permission(auth.uid(), 'manage_users') OR private.has_permission(auth.uid(), 'view_all_campaigns'));

-- app_settings
DROP POLICY IF EXISTS "admin writes" ON public.app_settings;
CREATE POLICY "admin writes" ON public.app_settings FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- user_roles
DROP POLICY IF EXISTS "admins manage non-privileged roles" ON public.user_roles;
CREATE POLICY "admins manage non-privileged roles" ON public.user_roles FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin') AND (role <> ALL (ARRAY['admin'::public.app_role, 'super_admin'::public.app_role])))
  WITH CHECK (private.has_role(auth.uid(), 'admin') AND (role <> ALL (ARRAY['admin'::public.app_role, 'super_admin'::public.app_role])));

DROP POLICY IF EXISTS "super admin manages all roles" ON public.user_roles;
CREATE POLICY "super admin manages all roles" ON public.user_roles FOR ALL TO authenticated
  USING (private.is_super_admin(auth.uid()))
  WITH CHECK (private.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "users see own roles" ON public.user_roles;
CREATE POLICY "users see own roles" ON public.user_roles FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR private.is_staff(auth.uid()));

-- user_permissions
DROP POLICY IF EXISTS "self read perms" ON public.user_permissions;
CREATE POLICY "self read perms" ON public.user_permissions FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR private.is_super_admin(auth.uid()) OR private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "super admin writes perms" ON public.user_permissions;
CREATE POLICY "super admin writes perms" ON public.user_permissions FOR ALL TO authenticated
  USING (private.is_super_admin(auth.uid()))
  WITH CHECK (private.is_super_admin(auth.uid()));

-- campaigns
DROP POLICY IF EXISTS "view own or staff" ON public.campaigns;
CREATE POLICY "view own or staff" ON public.campaigns FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR private.has_permission(auth.uid(), 'view_all_campaigns'));

DROP POLICY IF EXISTS "update own or staff" ON public.campaigns;
CREATE POLICY "update own or staff" ON public.campaigns FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()) OR private.has_permission(auth.uid(), 'view_all_campaigns'));

-- campaign_files
DROP POLICY IF EXISTS "via campaign" ON public.campaign_files;
CREATE POLICY "via campaign" ON public.campaign_files FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_files.campaign_id
    AND (c.user_id = auth.uid() OR private.has_permission(auth.uid(), 'download_campaign_files'))));

DROP POLICY IF EXISTS "insert via campaign" ON public.campaign_files;
CREATE POLICY "insert via campaign" ON public.campaign_files FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_files.campaign_id
    AND (c.user_id = auth.uid() OR private.has_permission(auth.uid(), 'view_all_campaigns'))));

DROP POLICY IF EXISTS "delete via campaign" ON public.campaign_files;
CREATE POLICY "delete via campaign" ON public.campaign_files FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_files.campaign_id
    AND (c.user_id = auth.uid() OR private.has_permission(auth.uid(), 'view_all_campaigns'))));

-- campaign_deliveries
DROP POLICY IF EXISTS "deliveries via campaign" ON public.campaign_deliveries;
CREATE POLICY "deliveries via campaign" ON public.campaign_deliveries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_deliveries.campaign_id
    AND (c.user_id = auth.uid() OR private.has_permission(auth.uid(), 'view_all_campaigns'))));

-- credit_balances / credit_transactions
DROP POLICY IF EXISTS "view own or staff" ON public.credit_balances;
CREATE POLICY "view own or staff" ON public.credit_balances FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR private.has_permission(auth.uid(), 'manage_credits') OR private.has_permission(auth.uid(), 'view_all_campaigns'));

DROP POLICY IF EXISTS "view own or staff" ON public.credit_transactions;
CREATE POLICY "view own or staff" ON public.credit_transactions FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR private.has_permission(auth.uid(), 'manage_credits') OR private.has_permission(auth.uid(), 'view_all_campaigns'));

-- client_pricing_overrides
DROP POLICY IF EXISTS "manage pricing overrides" ON public.client_pricing_overrides;
CREATE POLICY "manage pricing overrides" ON public.client_pricing_overrides FOR ALL TO authenticated
  USING (private.has_permission(auth.uid(), 'manage_pricing'))
  WITH CHECK (private.has_permission(auth.uid(), 'manage_pricing'));

DROP POLICY IF EXISTS "view own or pricing staff" ON public.client_pricing_overrides;
CREATE POLICY "view own or pricing staff" ON public.client_pricing_overrides FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR private.has_permission(auth.uid(), 'manage_pricing'));

-- message_templates
DROP POLICY IF EXISTS "manage templates" ON public.message_templates;
CREATE POLICY "manage templates" ON public.message_templates FOR ALL TO authenticated
  USING (private.has_permission(auth.uid(), 'edit_templates'))
  WITH CHECK (private.has_permission(auth.uid(), 'edit_templates'));

-- wa_templates
DROP POLICY IF EXISTS "wa_templates read" ON public.wa_templates;
CREATE POLICY "wa_templates read" ON public.wa_templates FOR SELECT TO authenticated
  USING (private.has_permission(auth.uid(), 'edit_templates') OR private.has_permission(auth.uid(), 'manage_infobip') OR private.has_permission(auth.uid(), 'view_all_campaigns'));

DROP POLICY IF EXISTS "wa_templates manage" ON public.wa_templates;
CREATE POLICY "wa_templates manage" ON public.wa_templates FOR ALL TO authenticated
  USING (private.has_permission(auth.uid(), 'edit_templates') OR private.has_permission(auth.uid(), 'manage_infobip'))
  WITH CHECK (private.has_permission(auth.uid(), 'edit_templates') OR private.has_permission(auth.uid(), 'manage_infobip'));

-- niches: scope to authenticated and use private helpers
DROP POLICY IF EXISTS "manage niches" ON public.niches;
CREATE POLICY "manage niches" ON public.niches FOR ALL TO authenticated
  USING (private.has_permission(auth.uid(), 'manage_niches') OR private.has_permission(auth.uid(), 'manage_pricing'))
  WITH CHECK (private.has_permission(auth.uid(), 'manage_niches') OR private.has_permission(auth.uid(), 'manage_pricing'));

DROP POLICY IF EXISTS "authenticated users read active niches" ON public.niches;
CREATE POLICY "authenticated users read active niches" ON public.niches FOR SELECT TO authenticated
  USING ((is_active = true) OR private.has_permission(auth.uid(), 'manage_niches') OR private.has_permission(auth.uid(), 'manage_pricing'));

-- short_links / short_link_urls: rewrite to private helpers
DROP POLICY IF EXISTS "owners read short links" ON public.short_links;
CREATE POLICY "owners read short links" ON public.short_links FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR private.has_permission(auth.uid(), 'view_shortener_admin'));

DROP POLICY IF EXISTS "owners update short links" ON public.short_links;
CREATE POLICY "owners update short links" ON public.short_links FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()) OR private.has_permission(auth.uid(), 'view_shortener_admin'));

DROP POLICY IF EXISTS "owners delete short links" ON public.short_links;
CREATE POLICY "owners delete short links" ON public.short_links FOR DELETE TO authenticated
  USING ((user_id = auth.uid()) OR private.has_permission(auth.uid(), 'view_shortener_admin'));

DROP POLICY IF EXISTS "owners read short link urls" ON public.short_link_urls;
CREATE POLICY "owners read short link urls" ON public.short_link_urls FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.short_links sl WHERE sl.id = short_link_urls.short_link_id
    AND (sl.user_id = auth.uid() OR private.has_permission(auth.uid(), 'view_shortener_admin'))));

DROP POLICY IF EXISTS "owners update short link urls" ON public.short_link_urls;
CREATE POLICY "owners update short link urls" ON public.short_link_urls FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.short_links sl WHERE sl.id = short_link_urls.short_link_id
    AND (sl.user_id = auth.uid() OR private.has_permission(auth.uid(), 'view_shortener_admin'))));

DROP POLICY IF EXISTS "owners delete short link urls" ON public.short_link_urls;
CREATE POLICY "owners delete short link urls" ON public.short_link_urls FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.short_links sl WHERE sl.id = short_link_urls.short_link_id
    AND (sl.user_id = auth.uid() OR private.has_permission(auth.uid(), 'view_shortener_admin'))));

-- Drop the now-unused public helpers (cascade revokes any leftover grants)
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role) CASCADE;
DROP FUNCTION IF EXISTS public.has_permission(uuid, public.app_permission) CASCADE;
DROP FUNCTION IF EXISTS public.is_staff(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_super_admin(uuid) CASCADE;

-- Lock down trigger-only SECURITY DEFINER functions: nobody calls them via the API.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_super_admin() FROM public, anon, authenticated;
