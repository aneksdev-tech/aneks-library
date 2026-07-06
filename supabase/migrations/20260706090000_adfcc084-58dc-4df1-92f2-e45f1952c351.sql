
-- File paths are structured as: <user_id>/<uuid>-<filename>

-- Users can upload/manage files in their own folder in resources bucket
CREATE POLICY "Users upload own resources files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('resources','thumbnails','avatars')
             AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('resources','thumbnails','avatars')
         AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('resources','thumbnails','avatars')
         AND auth.uid()::text = (storage.foldername(name))[1]);

-- Uploaders can read their own files (any status)
CREATE POLICY "Users read own files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('resources','thumbnails','avatars')
         AND auth.uid()::text = (storage.foldername(name))[1]);

-- Anyone can read files that back an approved resource
CREATE POLICY "Public read approved resource files" ON storage.objects FOR SELECT TO anon, authenticated
  USING (
    bucket_id IN ('resources','thumbnails')
    AND EXISTS (
      SELECT 1 FROM public.resources r
      WHERE (r.file_path = name OR r.thumbnail_path = name)
        AND r.status = 'approved'
    )
  );

-- Avatars are readable by anyone (owner path enforced on write)
CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'avatars');

-- Admins manage all files
CREATE POLICY "Admins manage all storage" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id IN ('resources','thumbnails','avatars') AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id IN ('resources','thumbnails','avatars') AND public.is_admin(auth.uid()));
