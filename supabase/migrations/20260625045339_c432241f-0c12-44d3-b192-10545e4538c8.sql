DROP POLICY IF EXISTS "campaign files read" ON storage.objects;
DROP POLICY IF EXISTS "campaign files insert" ON storage.objects;
DROP POLICY IF EXISTS "campaign files delete" ON storage.objects;

CREATE POLICY "campaign files read" ON storage.objects FOR SELECT
USING (
  bucket_id = 'campaign-files' AND EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE (c.id)::text = (storage.foldername(storage.objects.name))[1]
      AND (c.user_id = auth.uid() OR public.is_staff(auth.uid()))
  )
);

CREATE POLICY "campaign files insert" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'campaign-files' AND EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE (c.id)::text = (storage.foldername(storage.objects.name))[1]
      AND (c.user_id = auth.uid() OR public.is_staff(auth.uid()))
  )
);

CREATE POLICY "campaign files delete" ON storage.objects FOR DELETE
USING (
  bucket_id = 'campaign-files' AND EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE (c.id)::text = (storage.foldername(storage.objects.name))[1]
      AND (c.user_id = auth.uid() OR public.is_staff(auth.uid()))
  )
);