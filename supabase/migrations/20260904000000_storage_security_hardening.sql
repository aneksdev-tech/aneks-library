-- ============================================================
-- B1: Storage Security Hardening
-- ============================================================
-- Goals:
-- 1. Keep resource/thumbnails buckets private.
-- 2. Remove public direct access to approved resources.
-- 3. Restrict uploader resource modification/deletion to drafts.
-- 4. Keep Lecturer/Staff pending-file deletion for moderation.
-- 5. Preserve public avatar reads.
-- 6. Preserve Admin/Co-admin full Storage management.
-- 7. Enforce resource/path ownership correspondence for
--    resource-file UPDATE operations.
-- ============================================================


-- ============================================================
-- 1. Remove existing resource Storage policies that will be
--    replaced.
-- ============================================================

DROP POLICY IF EXISTS "Public read approved resource files"
ON storage.objects;

DROP POLICY IF EXISTS "Users read own resource files"
ON storage.objects;

DROP POLICY IF EXISTS "Users update own resource files"
ON storage.objects;

DROP POLICY IF EXISTS "Users delete own resource files"
ON storage.objects;

DROP POLICY IF EXISTS "Users upload own resource files"
ON storage.objects;

DROP POLICY IF EXISTS "Lecturers and staff delete pending resource files"
ON storage.objects;

DROP POLICY IF EXISTS "Admins manage all storage"
ON storage.objects;


-- ============================================================
-- 2. Admin / Co-admin full Storage management
-- ============================================================

CREATE POLICY "Admins manage all storage"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id IN (
    'resources',
    'thumbnails',
    'avatars'
  )
  AND is_admin_or_coadmin(auth.uid())
)
WITH CHECK (
  bucket_id IN (
    'resources',
    'thumbnails',
    'avatars'
  )
  AND is_admin_or_coadmin(auth.uid())
);


-- ============================================================
-- 3. Users upload their own resource files
-- ============================================================
-- Upload remains intentionally independent of the resources
-- table because the application uploads the Storage object
-- before creating/updating the corresponding resource row.
--
-- The user's UUID must be the first path segment.
-- ============================================================

CREATE POLICY "Users upload own resource files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN (
    'resources',
    'thumbnails'
  )
  AND (storage.foldername(name))[1] = auth.uid()::text
);


-- ============================================================
-- 4. Users read their own resource files
-- ============================================================
-- This does NOT expose approved files publicly.
-- It allows an authenticated uploader to access their own
-- Storage objects.
-- ============================================================

CREATE POLICY "Users read own resource files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id IN (
    'resources',
    'thumbnails'
  )
  AND owner_id = auth.uid()::text
);


-- ============================================================
-- 5. Users update their own resource files — DRAFT ONLY
-- ============================================================
-- The existing policy allowed pending/rejected resources to
-- be modified. That is too broad.
--
-- Both the old object and the resulting object must correspond
-- to the user's own draft resource.
--
-- The new object path must remain the resource's registered
-- file_path/thumbnail_path, preventing arbitrary path changes.
-- ============================================================

CREATE POLICY "Users update own resource files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id IN (
    'resources',
    'thumbnails'
  )
  AND owner_id = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.resources r
    WHERE
      r.uploader_id = auth.uid()
      AND r.status = 'draft'::public.resource_status
      AND (
        (
          storage.objects.bucket_id = 'resources'
          AND r.file_path = storage.objects.name
        )
        OR
        (
          storage.objects.bucket_id = 'thumbnails'
          AND r.thumbnail_path = storage.objects.name
        )
      )
  )
)
WITH CHECK (
  bucket_id IN (
    'resources',
    'thumbnails'
  )
  AND owner_id = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.resources r
    WHERE
      r.uploader_id = auth.uid()
      AND r.status = 'draft'::public.resource_status
      AND (
        (
          storage.objects.bucket_id = 'resources'
          AND r.file_path = storage.objects.name
        )
        OR
        (
          storage.objects.bucket_id = 'thumbnails'
          AND r.thumbnail_path = storage.objects.name
        )
      )
  )
);


-- ============================================================
-- 6. Users delete their own resource files — DRAFT ONLY
-- ============================================================

CREATE POLICY "Users delete own resource files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id IN (
    'resources',
    'thumbnails'
  )
  AND owner_id = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.resources r
    WHERE
      r.uploader_id = auth.uid()
      AND r.status = 'draft'::public.resource_status
      AND (
        (
          storage.objects.bucket_id = 'resources'
          AND r.file_path = storage.objects.name
        )
        OR
        (
          storage.objects.bucket_id = 'thumbnails'
          AND r.thumbnail_path = storage.objects.name
        )
      )
  )
);


-- ============================================================
-- 7. Lecturer / Staff pending-file deletion
-- ============================================================
-- Retained because moderation may need to remove the physical
-- Storage object associated with a pending resource.
-- ============================================================

CREATE POLICY "Lecturers and staff delete pending resource files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id IN (
    'resources',
    'thumbnails'
  )
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE
      p.id = auth.uid()
      AND p.status = 'active'::public.account_status
      AND p.primary_role IN (
        'lecturer'::public.app_role,
        'staff'::public.app_role
      )
  )
  AND EXISTS (
    SELECT 1
    FROM public.resources r
    WHERE
      r.status = 'pending'::public.resource_status
      AND (
        (
          storage.objects.bucket_id = 'resources'
          AND r.file_path = storage.objects.name
        )
        OR
        (
          storage.objects.bucket_id = 'thumbnails'
          AND r.thumbnail_path = storage.objects.name
        )
      )
  )
);


-- ============================================================
-- 8. Recreate avatar policies
-- ============================================================
-- Avatars remain publicly readable.
-- ============================================================

DROP POLICY IF EXISTS "Public read avatars"
ON storage.objects;

DROP POLICY IF EXISTS "Users upload own avatars"
ON storage.objects;

DROP POLICY IF EXISTS "Users update own avatars"
ON storage.objects;

DROP POLICY IF EXISTS "Users delete own avatars"
ON storage.objects;


CREATE POLICY "Public read avatars"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'avatars'
);


CREATE POLICY "Users upload own avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);


CREATE POLICY "Users update own avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND owner_id = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND owner_id = auth.uid()::text
);


CREATE POLICY "Users delete own avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND owner_id = auth.uid()::text
);


-- ============================================================
-- 9. Database privilege hardening
-- ============================================================

REVOKE INSERT,
        UPDATE,
        DELETE,
        REFERENCES,
        TRIGGER,
        TRUNCATE
ON TABLE public.resources
FROM anon;

REVOKE INSERT,
        UPDATE,
        DELETE,
        REFERENCES,
        TRIGGER,
        TRUNCATE
ON TABLE public.profiles
FROM anon;

REVOKE ALL
ON TABLE public.user_roles
FROM anon;


-- ============================================================
-- 10. RPC execution hardening
-- ============================================================

REVOKE ALL
ON FUNCTION public.approve_resource(uuid)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.approve_resource(uuid)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.approve_resource(uuid)
TO authenticated;


REVOKE ALL
ON FUNCTION public.reject_resource(uuid, text)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.reject_resource(uuid, text)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.reject_resource(uuid, text)
TO authenticated;