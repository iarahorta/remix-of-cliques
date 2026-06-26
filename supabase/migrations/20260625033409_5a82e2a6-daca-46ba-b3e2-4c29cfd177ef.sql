
-- Update handle_new_user: only iarachorta@gmail.com can become admin on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles(id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  IF lower(NEW.email) = 'iarachorta@gmail.com' THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'super_admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'client')
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  INSERT INTO public.credit_balances(user_id, balance_cents) VALUES (NEW.id, 0)
    ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Seed super_admin for iarachorta@gmail.com (if user exists)
DO $$
DECLARE
  chief_id uuid;
BEGIN
  SELECT id INTO chief_id FROM auth.users WHERE lower(email) = 'iarachorta@gmail.com' LIMIT 1;
  IF chief_id IS NOT NULL THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (chief_id, 'super_admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.user_roles(user_id, role) VALUES (chief_id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;

    -- Demote every other admin to client
    DELETE FROM public.user_roles
      WHERE role = 'admin' AND user_id <> chief_id;
    INSERT INTO public.user_roles(user_id, role)
      SELECT u.id, 'client'::public.app_role
      FROM auth.users u
      WHERE u.id <> chief_id
        AND NOT EXISTS (
          SELECT 1 FROM public.user_roles r
           WHERE r.user_id = u.id AND r.role IN ('client','operator')
        )
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

-- Helper: is_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin')
$$;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;

-- Tighten user_roles policies
DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;

-- Super admin manages everything
CREATE POLICY "super admin manages all roles" ON public.user_roles
  FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Regular admins can only manage non-privileged rows (client/operator)
CREATE POLICY "admins manage non-privileged roles" ON public.user_roles
  FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin')
    AND role NOT IN ('admin','super_admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND role NOT IN ('admin','super_admin')
  );

-- Trigger: protect super_admin row from being touched by anyone except service_role / themselves
CREATE OR REPLACE FUNCTION public.protect_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_user uuid;
  target_role public.app_role;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_user := OLD.user_id;
    target_role := OLD.role;
  ELSE
    target_user := NEW.user_id;
    target_role := NEW.role;
  END IF;

  IF target_role = 'super_admin' AND auth.role() <> 'service_role' AND auth.uid() <> target_user THEN
    RAISE EXCEPTION 'super_admin row is protected';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.protect_super_admin() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_super_admin_trg ON public.user_roles;
CREATE TRIGGER protect_super_admin_trg
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin();

-- Protect super_admin profile permissions from being edited by non-super-admins
CREATE OR REPLACE FUNCTION public.protect_profile_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Super admin profile: only service_role or themselves
  IF public.is_super_admin(OLD.id)
     AND auth.role() <> 'service_role'
     AND auth.uid() <> OLD.id THEN
    NEW.can_customize_profile_photo := OLD.can_customize_profile_photo;
    NEW.can_use_hygiene_tool := OLD.can_use_hygiene_tool;
    RETURN NEW;
  END IF;

  -- Non-admins cannot change privileged columns on any profile
  IF auth.role() <> 'service_role' AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.can_customize_profile_photo := OLD.can_customize_profile_photo;
    NEW.can_use_hygiene_tool := OLD.can_use_hygiene_tool;
  END IF;
  RETURN NEW;
END;
$$;
