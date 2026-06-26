
DROP POLICY IF EXISTS "profile photos read" ON storage.objects;
CREATE POLICY "profile photos read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'campaign-profile-photos');

DROP POLICY IF EXISTS "profile photos admin write" ON storage.objects;
CREATE POLICY "profile photos admin write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'campaign-profile-photos' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "profile photos admin update" ON storage.objects;
CREATE POLICY "profile photos admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'campaign-profile-photos' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "profile photos admin delete" ON storage.objects;
CREATE POLICY "profile photos admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'campaign-profile-photos' AND public.has_role(auth.uid(), 'admin'));
