-- ============================================================
-- Aneks Library
-- Migration C: Resource Authorization Hardening
-- ============================================================
--
-- Goals:
--   1. Allow uploaders to edit only their own drafts.
--   2. Allow uploaders to delete only their own drafts.
--   3. Prevent uploaders from changing resource ownership,
--      lifecycle, counters, or administrative metadata.
--   4. Preserve Admin/Co-admin full resource management.
--   5. Preserve Lecturer/Staff approval and rejection through
--      the existing secure RPCs.
--
-- Existing secure RPCs:
--   approve_resource(uuid)
--   reject_resource(uuid, text)
--
-- ============================================================


-- ============================================================
-- PART 1
-- Remove the old overly-broad uploader UPDATE policy.
-- ============================================================

DROP POLICY IF EXISTS
  "Uploaders edit pending"
ON public.resources;


-- ============================================================
-- PART 2
-- Uploaders may edit ONLY their own draft resources.
-- ============================================================

DROP POLICY IF EXISTS
  "Uploaders edit own drafts"
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
  AND status = 'draft'::public.resource_status
);


-- ============================================================
-- PART 3
-- Remove the old overly-broad uploader DELETE policy.
-- ============================================================

DROP POLICY IF EXISTS
  "Uploaders delete pending"
ON public.resources;


-- ============================================================
-- PART 4
-- Uploaders may hard-delete ONLY their own drafts.
--
-- Pending, approved, rejected, and deleted resources remain
-- controlled by the resource lifecycle.
-- ============================================================

DROP POLICY IF EXISTS
  "Uploaders delete own drafts"
ON public.resources;

CREATE POLICY "Uploaders delete own drafts"
ON public.resources
FOR DELETE
TO authenticated
USING (
  auth.uid() = uploader_id
  AND status = 'draft'::public.resource_status
);


-- ============================================================
-- PART 5
-- Protect system-controlled resource fields.
--
-- Admin/Co-admin:
--   Full administrative resource updates remain allowed.
--
-- Lecturer/Staff:
--   Approval/rejection is performed through the existing
--   SECURITY DEFINER RPCs.
--
-- Ordinary uploader updates:
--   RLS already limits them to draft resources.
--
-- The trigger therefore:
--   - prevents ownership changes;
--   - prevents counter manipulation;
--   - prevents approval metadata manipulation;
--   - prevents rejection metadata manipulation;
--   - prevents deletion metadata manipulation;
--   - prevents creation timestamp manipulation;
--   - permits the legitimate pending -> approved/rejected
--     lifecycle transition for authorized Lecturer/Staff RPCs.
-- ============================================================

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

  -- ----------------------------------------------------------
  -- Authentication
  -- ----------------------------------------------------------

  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;


  -- ----------------------------------------------------------
  -- Load active actor role
  -- ----------------------------------------------------------

  SELECT
    p.primary_role
  INTO
    _actor_role
  FROM public.profiles AS p
  WHERE
    p.id = _actor_id
    AND p.status = 'active'::public.account_status;


  -- ----------------------------------------------------------
  -- Admin and Co-admin retain full resource administration.
  -- ----------------------------------------------------------

  IF _actor_role IN (
    'admin'::public.app_role,
    'co-admin'::public.app_role
  ) THEN
    RETURN NEW;
  END IF;


  -- ----------------------------------------------------------
  -- Ownership may never be changed by non-admin actors.
  -- ----------------------------------------------------------

  IF NEW.uploader_id IS DISTINCT FROM OLD.uploader_id THEN
    RAISE EXCEPTION
      'You cannot change the resource uploader';
  END IF;


  -- ----------------------------------------------------------
  -- Download counter is system-controlled.
  -- ----------------------------------------------------------

  IF NEW.download_count IS DISTINCT FROM OLD.download_count THEN
    RAISE EXCEPTION
      'You cannot change the download count';
  END IF;


  -- ----------------------------------------------------------
  -- Bookmark counter is system-controlled.
  -- ----------------------------------------------------------

  IF NEW.bookmark_count IS DISTINCT FROM OLD.bookmark_count THEN
    RAISE EXCEPTION
      'You cannot change the bookmark count';
  END IF;


  -- ----------------------------------------------------------
  -- Creation timestamp is system-controlled.
  -- ----------------------------------------------------------

  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION
      'You cannot change the creation timestamp';
  END IF;


  -- ----------------------------------------------------------
  -- Deletion metadata is system-controlled.
  -- ----------------------------------------------------------

  IF NEW.deleted_by IS DISTINCT FROM OLD.deleted_by
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION
      'You cannot change deletion metadata';
  END IF;


  -- ----------------------------------------------------------
  -- Approval metadata is system-controlled.
  --
  -- Lecturer/Staff approval RPCs are allowed to modify these
  -- fields only as part of the legitimate pending -> approved
  -- transition.
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
    RAISE EXCEPTION
      'You cannot change approval metadata';
  END IF;


  -- ----------------------------------------------------------
  -- Rejection metadata is system-controlled.
  --
  -- Lecturer/Staff rejection RPCs are allowed to modify these
  -- fields only as part of the legitimate pending -> rejected
  -- transition.
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
    RAISE EXCEPTION
      'You cannot change rejection metadata';
  END IF;


  -- ----------------------------------------------------------
  -- Lifecycle status protection.
  --
  -- Ordinary users cannot change status.
  --
  -- Lecturer/Staff may perform only the two legitimate
  -- moderation transitions:
  --
  --   pending -> approved
  --   pending -> rejected
  --
  -- These correspond to the existing secured RPCs.
  -- ----------------------------------------------------------

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (
       _actor_role IN (
         'lecturer'::public.app_role,
         'staff'::public.app_role
       )
       AND OLD.status = 'pending'::public.resource_status
       AND NEW.status IN (
         'approved'::public.resource_status,
         'rejected'::public.resource_status
       )
     ) THEN
    RAISE EXCEPTION
      'You cannot change the resource status';
  END IF;


  -- ----------------------------------------------------------
  -- Rejection may reset file_size to zero through the
  -- existing reject_resource() RPC.
  --
  -- Outside the legitimate pending -> rejected transition,
  -- file_size remains protected from non-admin manipulation.
  -- ----------------------------------------------------------

  IF NEW.file_size IS DISTINCT FROM OLD.file_size
     AND NOT (
       _actor_role IN (
         'lecturer'::public.app_role,
         'staff'::public.app_role
       )
       AND OLD.status = 'pending'::public.resource_status
       AND NEW.status = 'rejected'::public.resource_status
     ) THEN
    RAISE EXCEPTION
      'You cannot change the resource file size';
  END IF;


  -- ----------------------------------------------------------
  -- If Lecturer/Staff are performing a moderation transition,
  -- prevent unrelated resource fields from being modified
  -- at the same time.
  --
  -- Approval/rejection RPCs are allowed to modify only the
  -- lifecycle/system fields associated with that transition.
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
      RAISE EXCEPTION
        'Moderation cannot modify resource content or ownership';
    END IF;

  END IF;


  RETURN NEW;

END;
$function$;


-- ============================================================
-- PART 6
-- Replace the resource protection trigger.
-- ============================================================

DROP TRIGGER IF EXISTS
  trg_protect_resource_system_fields
ON public.resources;

CREATE TRIGGER trg_protect_resource_system_fields
BEFORE UPDATE
ON public.resources
FOR EACH ROW
EXECUTE FUNCTION public.protect_resource_system_fields();


-- ============================================================
-- PART 7
-- Prevent direct RPC execution of the trigger function.
--
-- PostgreSQL invokes trigger functions internally, so callers
-- do not need EXECUTE permission.
-- ============================================================

REVOKE ALL
ON FUNCTION public.protect_resource_system_fields()
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.protect_resource_system_fields()
FROM anon;

REVOKE ALL
ON FUNCTION public.protect_resource_system_fields()
FROM authenticated;


-- ============================================================
-- PART 8
-- Reconfirm approval/rejection RPC privileges.
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


-- ============================================================
-- END OF MIGRATION C
-- ============================================================