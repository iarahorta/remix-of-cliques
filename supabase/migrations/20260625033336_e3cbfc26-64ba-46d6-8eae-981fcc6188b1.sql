
-- 1. Restore EXECUTE on functions used by RLS policies
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;

-- 2. Add super_admin to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
