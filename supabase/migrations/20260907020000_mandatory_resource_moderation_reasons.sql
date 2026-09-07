BEGIN;

-- ============================================================
-- 1. Add deletion_reason to resources
-- ============================================================

ALTER TABLE public.resources
ADD COLUMN IF NOT EXISTS deletion_reason TEXT;


-- ============================================================
-- 2. Protect deletion_reason as system-controlled metadata
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
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT p.primary_role
  INTO _actor_role
  FROM public.profiles AS p
  WHERE p.id = _actor_id
    AND p.status = 'active'::public.account_status;

  -- Admin / Co-admin: full authority
  IF _actor_role IN (
    'admin'::public.app_role,
    'co-admin'::public.app_role
  ) THEN
    RETURN NEW;
  END IF;

  -- Ownership protection
  IF NEW.uploader_id IS DISTINCT FROM OLD.uploader_id THEN
    RAISE EXCEPTION 'You cannot change the resource uploader';
  END IF;

  -- Immutable counters
  IF NEW.download_count IS DISTINCT FROM OLD.download_count THEN
    RAISE EXCEPTION 'You cannot change the download count';
  END IF;

  IF NEW.bookmark_count IS DISTINCT FROM OLD.bookmark_count THEN
    RAISE EXCEPTION 'You cannot change the bookmark count';
  END IF;

  -- Immutable creation timestamp
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'You cannot change the creation timestamp';
  END IF;

  -- Deletion metadata remains system-controlled
  IF NEW.deleted_by IS DISTINCT FROM OLD.deleted_by
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     OR NEW.deletion_reason IS DISTINCT FROM OLD.deletion_reason THEN
    RAISE EXCEPTION 'You cannot change deletion metadata';
  END IF;

  -- Approval metadata
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

  -- Rejection metadata
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

  -- Status protection
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

  -- file_size
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

  -- Lecturer/Staff moderation protection
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


-- ============================================================
-- 3. Make rejection reason mandatory at database level
-- ============================================================

CREATE OR REPLACE FUNCTION public.reject_resource(
  _resource_id uuid,
  _rejection_reason text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  _actor_id uuid := auth.uid();
  _actor_role public.app_role;
  _resource_status public.resource_status;
BEGIN

  -- ----------------------------------------------------------
  -- Authentication
  -- ----------------------------------------------------------
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;


  -- ----------------------------------------------------------
  -- Mandatory rejection reason
  -- ----------------------------------------------------------
  IF NULLIF(btrim(_rejection_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A rejection reason is required';
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


  IF _actor_role IS NULL THEN
    RAISE EXCEPTION
      'Your account is not authorized to reject resources';
  END IF;


  -- ----------------------------------------------------------
  -- Authorization
  -- ----------------------------------------------------------
  IF _actor_role NOT IN (
    'admin'::public.app_role,
    'co-admin'::public.app_role,
    'lecturer'::public.app_role,
    'staff'::public.app_role
  ) THEN
    RAISE EXCEPTION
      'You do not have permission to reject resources';
  END IF;


  -- ----------------------------------------------------------
  -- Load resource
  -- ----------------------------------------------------------
  SELECT
    r.status
  INTO
    _resource_status
  FROM public.resources AS r
  WHERE
    r.id = _resource_id;


  IF _resource_status IS NULL THEN
    RAISE EXCEPTION 'Resource not found';
  END IF;


  -- ----------------------------------------------------------
  -- Only pending resources can be rejected
  -- ----------------------------------------------------------
  IF _resource_status <> 'pending'::public.resource_status THEN
    RAISE EXCEPTION
      'Only pending resources can be rejected';
  END IF;


  -- ----------------------------------------------------------
  -- Reject resource
  -- ----------------------------------------------------------
  UPDATE public.resources
  SET
    status = 'rejected'::public.resource_status,
    rejection_reason = btrim(_rejection_reason),
    approved_by = NULL,
    approved_at = NULL,
    rejected_by = _actor_id,
    rejected_at = clock_timestamp(),
    deleted_at = NULL,
    deleted_by = NULL,
    file_size = 0
  WHERE
    id = _resource_id
    AND status = 'pending'::public.resource_status;


  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Resource is no longer pending';
  END IF;


  RETURN TRUE;

END;
$function$;


-- ============================================================
-- 4. Preserve intended RPC access
-- ============================================================

REVOKE EXECUTE
ON FUNCTION public.reject_resource(uuid, text)
FROM public, anon;

GRANT EXECUTE
ON FUNCTION public.reject_resource(uuid, text)
TO authenticated;

COMMIT;