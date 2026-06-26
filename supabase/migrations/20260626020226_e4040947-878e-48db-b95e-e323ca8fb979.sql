
-- RLS para buckets privados: campaign-files e campaign-profile-photos
-- Acesso: dono do arquivo (uploader) + staff (admin/super_admin)

DROP POLICY IF EXISTS "campaign_files_select" ON storage.objects;
DROP POLICY IF EXISTS "campaign_files_insert" ON storage.objects;
DROP POLICY IF EXISTS "campaign_files_update" ON storage.objects;
DROP POLICY IF EXISTS "campaign_files_delete" ON storage.objects;
DROP POLICY IF EXISTS "campaign_profile_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "campaign_profile_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "campaign_profile_photos_update" ON storage.objects;
DROP POLICY IF EXISTS "campaign_profile_photos_delete" ON storage.objects;

-- campaign-files
CREATE POLICY "campaign_files_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'campaign-files'
    AND (owner = auth.uid() OR private.is_staff(auth.uid()))
  );
CREATE POLICY "campaign_files_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'campaign-files'
    AND owner = auth.uid()
  );
CREATE POLICY "campaign_files_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'campaign-files'
    AND (owner = auth.uid() OR private.is_staff(auth.uid()))
  );
CREATE POLICY "campaign_files_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'campaign-files'
    AND (owner = auth.uid() OR private.is_staff(auth.uid()))
  );

-- campaign-profile-photos
CREATE POLICY "campaign_profile_photos_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'campaign-profile-photos'
    AND (owner = auth.uid() OR private.is_staff(auth.uid()))
  );
CREATE POLICY "campaign_profile_photos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'campaign-profile-photos'
    AND owner = auth.uid()
  );
CREATE POLICY "campaign_profile_photos_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'campaign-profile-photos'
    AND (owner = auth.uid() OR private.is_staff(auth.uid()))
  );
CREATE POLICY "campaign_profile_photos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'campaign-profile-photos'
    AND (owner = auth.uid() OR private.is_staff(auth.uid()))
  );
