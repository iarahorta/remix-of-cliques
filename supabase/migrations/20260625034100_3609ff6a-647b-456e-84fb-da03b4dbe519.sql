
-- 1. Table user_permissions
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission public.app_permission NOT NULL,
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission)
);

GRANT SELECT ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- 2. has_permission helper
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _perm public.app_permission)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR public.has_role(_user_id, 'super_admin')
    OR EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = _user_id AND permission = _perm)
$$;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, public.app_permission) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, public.app_permission) TO authenticated;

-- 3. Policies for user_permissions
DROP POLICY IF EXISTS "self read perms" ON public.user_permissions;
CREATE POLICY "self read perms" ON public.user_permissions
  FOR SELECT USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "super admin writes perms" ON public.user_permissions;
CREATE POLICY "super admin writes perms" ON public.user_permissions
  FOR ALL USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 4. Migrate existing flags to user_permissions
INSERT INTO public.user_permissions (user_id, permission)
  SELECT id, 'use_hygiene_tool'::public.app_permission FROM public.profiles WHERE can_use_hygiene_tool IS TRUE
  ON CONFLICT (user_id, permission) DO NOTHING;
INSERT INTO public.user_permissions (user_id, permission)
  SELECT id, 'customize_profile_photo'::public.app_permission FROM public.profiles WHERE can_customize_profile_photo IS TRUE
  ON CONFLICT (user_id, permission) DO NOTHING;

-- Drop old protection and columns
DROP FUNCTION IF EXISTS public.protect_profile_permissions() CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS can_use_hygiene_tool;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS can_customize_profile_photo;

-- 5. Update is_staff to include admin_jr
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _user_id
       AND role IN ('admin','super_admin','operator','admin_jr')
  )
$$;

-- 6. Replace per-table staff policies with permission-based ones
DROP POLICY IF EXISTS "view own or staff" ON public.campaigns;
CREATE POLICY "view own or staff" ON public.campaigns
  FOR SELECT USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'view_all_campaigns'));

DROP POLICY IF EXISTS "update own or staff" ON public.campaigns;
CREATE POLICY "update own or staff" ON public.campaigns
  FOR UPDATE USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'view_all_campaigns'));

DROP POLICY IF EXISTS "via campaign" ON public.campaign_files;
CREATE POLICY "via campaign" ON public.campaign_files
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.campaigns c
     WHERE c.id = campaign_files.campaign_id
       AND (c.user_id = auth.uid() OR public.has_permission(auth.uid(), 'download_campaign_files'))
  ));

DROP POLICY IF EXISTS "insert via campaign" ON public.campaign_files;
CREATE POLICY "insert via campaign" ON public.campaign_files
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.campaigns c
     WHERE c.id = campaign_files.campaign_id
       AND (c.user_id = auth.uid() OR public.has_permission(auth.uid(), 'view_all_campaigns'))
  ));

DROP POLICY IF EXISTS "delete via campaign" ON public.campaign_files;
CREATE POLICY "delete via campaign" ON public.campaign_files
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.campaigns c
     WHERE c.id = campaign_files.campaign_id
       AND (c.user_id = auth.uid() OR public.has_permission(auth.uid(), 'view_all_campaigns'))
  ));

DROP POLICY IF EXISTS "view own or staff" ON public.profiles;
CREATE POLICY "view own or staff" ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.has_permission(auth.uid(), 'manage_users') OR public.has_permission(auth.uid(), 'view_all_campaigns'));

DROP POLICY IF EXISTS "update own or admin" ON public.profiles;
CREATE POLICY "update own or admin" ON public.profiles
  FOR UPDATE USING (id = auth.uid() OR public.has_permission(auth.uid(), 'manage_users'));

DROP POLICY IF EXISTS "admin updates any profile" ON public.profiles;
CREATE POLICY "admin updates any profile" ON public.profiles
  FOR UPDATE USING (public.has_permission(auth.uid(), 'manage_users'))
  WITH CHECK (public.has_permission(auth.uid(), 'manage_users'));

DROP POLICY IF EXISTS "view own or staff" ON public.credit_balances;
CREATE POLICY "view own or staff" ON public.credit_balances
  FOR SELECT USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'manage_credits') OR public.has_permission(auth.uid(), 'view_all_campaigns'));

DROP POLICY IF EXISTS "view own or staff" ON public.credit_transactions;
CREATE POLICY "view own or staff" ON public.credit_transactions
  FOR SELECT USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'manage_credits') OR public.has_permission(auth.uid(), 'view_all_campaigns'));

DROP POLICY IF EXISTS "admins manage templates" ON public.message_templates;
CREATE POLICY "manage templates" ON public.message_templates
  FOR ALL USING (public.has_permission(auth.uid(), 'edit_templates'))
  WITH CHECK (public.has_permission(auth.uid(), 'edit_templates'));

DROP POLICY IF EXISTS "admins manage niches" ON public.niches;
CREATE POLICY "manage niches" ON public.niches
  FOR ALL USING (public.has_permission(auth.uid(), 'manage_niches') OR public.has_permission(auth.uid(), 'manage_pricing'))
  WITH CHECK (public.has_permission(auth.uid(), 'manage_niches') OR public.has_permission(auth.uid(), 'manage_pricing'));

DROP POLICY IF EXISTS "admins manage" ON public.client_pricing_overrides;
CREATE POLICY "manage pricing overrides" ON public.client_pricing_overrides
  FOR ALL USING (public.has_permission(auth.uid(), 'manage_pricing'))
  WITH CHECK (public.has_permission(auth.uid(), 'manage_pricing'));

DROP POLICY IF EXISTS "view own or staff" ON public.client_pricing_overrides;
CREATE POLICY "view own or pricing staff" ON public.client_pricing_overrides
  FOR SELECT USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'manage_pricing'));

DROP POLICY IF EXISTS "own or staff write" ON public.short_links;
CREATE POLICY "own or staff write" ON public.short_links
  FOR ALL USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'view_shortener_admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_permission(auth.uid(), 'view_shortener_admin'));

DROP POLICY IF EXISTS "owner staff write" ON public.short_link_urls;
CREATE POLICY "owner staff write" ON public.short_link_urls
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.short_links sl
     WHERE sl.id = short_link_urls.short_link_id
       AND (sl.user_id = auth.uid() OR public.has_permission(auth.uid(), 'view_shortener_admin'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.short_links sl
     WHERE sl.id = short_link_urls.short_link_id
       AND (sl.user_id = auth.uid() OR public.has_permission(auth.uid(), 'view_shortener_admin'))
  ));
