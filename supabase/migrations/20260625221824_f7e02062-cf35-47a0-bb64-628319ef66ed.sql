GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_balances TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.niches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_pricing_overrides TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_files TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.short_links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.short_link_urls TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_deliveries TO authenticated;

GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.user_roles TO service_role;
GRANT ALL ON public.user_permissions TO service_role;
GRANT ALL ON public.credit_balances TO service_role;
GRANT ALL ON public.credit_transactions TO service_role;
GRANT ALL ON public.niches TO service_role;
GRANT ALL ON public.client_pricing_overrides TO service_role;
GRANT ALL ON public.message_templates TO service_role;
GRANT ALL ON public.campaigns TO service_role;
GRANT ALL ON public.campaign_files TO service_role;
GRANT ALL ON public.short_links TO service_role;
GRANT ALL ON public.short_link_urls TO service_role;
GRANT ALL ON public.app_settings TO service_role;
GRANT ALL ON public.wa_templates TO service_role;
GRANT ALL ON public.campaign_deliveries TO service_role;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS protect_super_admin_update ON public.user_roles;
CREATE TRIGGER protect_super_admin_update
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin();

DROP TRIGGER IF EXISTS protect_super_admin_delete ON public.user_roles;
CREATE TRIGGER protect_super_admin_delete
  BEFORE DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin();

INSERT INTO public.profiles (id, email, full_name)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', 'Iara Chorta')
FROM auth.users
WHERE lower(email) = 'iarachorta@gmail.com'
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
    updated_at = now();

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role
FROM auth.users
WHERE lower(email) = 'iarachorta@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = 'iarachorta@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.credit_balances (user_id, balance_cents)
SELECT id, 0
FROM auth.users
WHERE lower(email) = 'iarachorta@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_permissions (user_id, permission)
SELECT u.id, p.permission::public.app_permission
FROM auth.users u
CROSS JOIN (VALUES
  ('view_all_campaigns'),
  ('download_campaign_files'),
  ('download_valid_leads'),
  ('edit_templates'),
  ('manage_pricing'),
  ('manage_niches'),
  ('manage_users'),
  ('view_shortener_admin'),
  ('use_hygiene_tool'),
  ('customize_profile_photo'),
  ('manage_credits'),
  ('manage_infobip')
) AS p(permission)
WHERE lower(u.email) = 'iarachorta@gmail.com'
ON CONFLICT (user_id, permission) DO NOTHING;