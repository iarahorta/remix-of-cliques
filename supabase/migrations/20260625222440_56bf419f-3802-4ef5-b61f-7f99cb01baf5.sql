-- Allow authenticated users to evaluate security helper functions used by RLS policies.
-- Keep anonymous/public visitors from calling them directly.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, public.app_permission) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, public.app_permission) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;

-- Niche pricing should be visible only inside the logged-in app.
DROP POLICY IF EXISTS "anyone reads active niches" ON public.niches;
CREATE POLICY "authenticated users read active niches"
ON public.niches
FOR SELECT
TO authenticated
USING (is_active = true OR public.has_permission(auth.uid(), 'manage_niches'::public.app_permission) OR public.has_permission(auth.uid(), 'manage_pricing'::public.app_permission));

-- Tighten campaign profile photo reads.
DROP POLICY IF EXISTS "profile photos read" ON storage.objects;
CREATE POLICY "profile photos read own staff or defaults"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'campaign-profile-photos'
  AND (
    (storage.foldername(name))[1] = 'defaults'
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_staff(auth.uid())
  )
);

-- Explicitly allow safe object replacement in campaign files under same ownership/staff rule.
DROP POLICY IF EXISTS "campaign files update" ON storage.objects;
CREATE POLICY "campaign files update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'campaign-files'
  AND EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (c.user_id = auth.uid() OR public.is_staff(auth.uid()))
  )
)
WITH CHECK (
  bucket_id = 'campaign-files'
  AND EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (c.user_id = auth.uid() OR public.is_staff(auth.uid()))
  )
);