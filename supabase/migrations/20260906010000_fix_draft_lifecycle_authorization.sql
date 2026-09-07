-- ============================================================
-- B1 FOLLOW-UP: Draft Lifecycle Authorization Fix
-- Migration: 20260906010000
-- ============================================================
-- Goals:
-- 1. Allow draft owners to edit their own drafts.
-- 2. Allow draft owners to replace the draft file, including
--    changing file_size.
-- 3. Allow draft owners to submit draft -> pending.
-- 4. Continue blocking owner edits after submission.
-- 5. Preserve all protected system-field rules.
-- 6. Preserve Lecturer/Staff moderation authority.
-- 7. Preserve Admin/Co-admin full authority.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Replace uploader UPDATE policy
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Uploaders edit own drafts"
ON public.resources;

CREATE POLICY "Uploaders edit own drafts"
ON public.resources
FOR UPDATE
TO authenticated
USING (
  auth.uid() = uploader_id
  AND status = 'draft'::public.resource_status
)
WITH CHECK (
  auth.uid() = uploader_id
  AND status IN (
    'draft'::public.resource_status,
    'pending'::public.resource_status
  )
);


-- ------------------------------------------------------------
-- 2. Update resource system-field protection
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_resource_system_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _actor_id uuid := auth.uid();
  _actor_role public.app_role;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT p.primary_role
  INTO _actor_role
  FROM public.profiles AS p
  WHERE p.id = _actor_id
    AND p.status = 'active'::public.account_status;


  -- ----------------------------------------------------------
  -- Admin / Co-admin: full authority
  -- ----------------------------------------------------------

  IF _actor_role IN (
    'admin'::public.app_role,
    'co-admin'::public.app_role
  ) THEN
    RETURN NEW;
  END IF;


  -- ----------------------------------------------------------
  -- Ownership protection
  -- ----------------------------------------------------------

  IF NEW.uploader_id IS DISTINCT FROM OLD.uploader_id THEN
    RAISE EXCEPTION 'You cannot change the resource uploader';
  END IF;


  -- ----------------------------------------------------------
  -- Immutable counters
  -- ----------------------------------------------------------

  IF NEW.download_count IS DISTINCT FROM OLD.download_count THEN
    RAISE EXCEPTION 'You cannot change the download count';
  END IF;

  IF NEW.bookmark_count IS DISTINCT FROM OLD.bookmark_count THEN
    RAISE EXCEPTION 'You cannot change the bookmark count';
  END IF;


  -- ----------------------------------------------------------
  -- Immutable creation timestamp
  -- ----------------------------------------------------------

  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'You cannot change the creation timestamp';
  END IF;


  -- ----------------------------------------------------------
  -- Deletion metadata remains system-controlled
  -- ----------------------------------------------------------

  IF NEW.deleted_by IS DISTINCT FROM OLD.deleted_by
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION 'You cannot change deletion metadata';
  END IF;


  -- ----------------------------------------------------------
  -- Approval metadata
  -- Only Lecturer/Staff may change this while moderating
  -- pending -> approved.
  -- ----------------------------------------------------------

  IF (
    NEW.approved_by IS DISTINCT FROM OLD.approved_by
    OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
  )
  AND NOT (
    _actor_role IN (
      'lecturer'::public.app_role,
      'staff'::public.app_role
    )
    AND OLD.status = 'pending'::public.resource_status
    AND NEW.status = 'approved'::public.resource_status
  ) THEN
    RAISE EXCEPTION 'You cannot change approval metadata';
  END IF;


  -- ----------------------------------------------------------
  -- Rejection metadata
  -- Only Lecturer/Staff may change this while moderating
  -- pending -> rejected.
  -- ----------------------------------------------------------

  IF (
    NEW.rejected_by IS DISTINCT FROM OLD.rejected_by
    OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at
    OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
  )
  AND NOT (
    _actor_role IN (
      'lecturer'::public.app_role,
      'staff'::public.app_role
    )
    AND OLD.status = 'pending'::public.resource_status
    AND NEW.status = 'rejected'::public.resource_status
  ) THEN
    RAISE EXCEPTION 'You cannot change rejection metadata';
  END IF;


  -- ----------------------------------------------------------
  -- Status protection
  --
  -- Owner:
  --   draft -> draft       allowed
  --   draft -> pending     allowed
  --
  -- Lecturer/Staff:
  --   pending -> approved  allowed
  --   pending -> rejected  allowed
  --
  -- Everything else remains blocked.
  -- ----------------------------------------------------------

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (
       (
         NEW.uploader_id = _actor_id
         AND OLD.status = 'draft'::public.resource_status
         AND NEW.status = 'pending'::public.resource_status
       )
       OR
       (
         _actor_role IN (
           'lecturer'::public.app_role,
           'staff'::public.app_role
         )
         AND OLD.status = 'pending'::public.resource_status
         AND NEW.status IN (
           'approved'::public.resource_status,
           'rejected'::public.resource_status
         )
       )
     ) THEN
    RAISE EXCEPTION 'You cannot change the resource status';
  END IF;


  -- ----------------------------------------------------------
  -- file_size
  --
  -- Draft owner may change file_size while the resource remains
  -- a draft OR while submitting draft -> pending.
  --
  -- Lecturer/Staff may change file_size only for
  -- pending -> rejected, because rejection cleanup sets it to 0.
  -- ----------------------------------------------------------

  IF NEW.file_size IS DISTINCT FROM OLD.file_size
     AND NOT (
       (
         NEW.uploader_id = _actor_id
         AND OLD.status = 'draft'::public.resource_status
         AND NEW.status IN (
           'draft'::public.resource_status,
           'pending'::public.resource_status
         )
       )
       OR
       (
         _actor_role IN (
           'lecturer'::public.app_role,
           'staff'::public.app_role
         )
         AND OLD.status = 'pending'::public.resource_status
         AND NEW.status = 'rejected'::public.resource_status
       )
     ) THEN
    RAISE EXCEPTION 'You cannot change the resource file size';
  END IF;


  -- ----------------------------------------------------------
  -- Lecturer/Staff moderation protection
  --
  -- When approving/rejecting a pending resource, moderation
  -- may change only the permitted moderation fields.
  -- ----------------------------------------------------------

  IF _actor_role IN (
       'lecturer'::public.app_role,
       'staff'::public.app_role
     )
     AND OLD.status = 'pending'::public.resource_status
     AND NEW.status IN (
       'approved'::public.resource_status,
       'rejected'::public.resource_status
     )
  THEN

    IF NEW.uploader_id IS DISTINCT FROM OLD.uploader_id
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.course_code IS DISTINCT FROM OLD.course_code
       OR NEW.department IS DISTINCT FROM OLD.department
       OR NEW.level IS DISTINCT FROM OLD.level
       OR NEW.author IS DISTINCT FROM OLD.author
       OR NEW.year IS DISTINCT FROM OLD.year
       OR NEW.tags IS DISTINCT FROM OLD.tags
       OR NEW.file_path IS DISTINCT FROM OLD.file_path
       OR NEW.file_name IS DISTINCT FROM OLD.file_name
       OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
       OR NEW.thumbnail_path IS DISTINCT FROM OLD.thumbnail_path
       OR NEW.category_id IS DISTINCT FROM OLD.category_id
       OR NEW.college IS DISTINCT FROM OLD.college
       OR NEW.semester IS DISTINCT FROM OLD.semester
       OR NEW.download_count IS DISTINCT FROM OLD.download_count
       OR NEW.bookmark_count IS DISTINCT FROM OLD.bookmark_count
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Moderation cannot modify resource content or ownership';
    END IF;

  END IF;


  RETURN NEW;
END;
$function$;


-- ------------------------------------------------------------
-- 3. Preserve function security
-- ------------------------------------------------------------

REVOKE ALL
ON FUNCTION public.protect_resource_system_fields()
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.protect_resource_system_fields()
FROM anon;

REVOKE ALL
ON FUNCTION public.protect_resource_system_fields()
FROM authenticated;