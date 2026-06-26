
-- Storage policies for campaign-files (path: {campaign_id}/{kind}/{filename})
CREATE POLICY "campaign files read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'campaign-files' AND EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (c.user_id = auth.uid() OR public.is_staff(auth.uid()))
  )
);
CREATE POLICY "campaign files insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'campaign-files' AND EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (c.user_id = auth.uid() OR public.is_staff(auth.uid()))
  )
);
CREATE POLICY "campaign files delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'campaign-files' AND EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (c.user_id = auth.uid() OR public.is_staff(auth.uid()))
  )
);
