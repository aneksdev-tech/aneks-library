-- ============================================================
-- ANEKS LIBRARY
-- FIX DOWNLOAD COUNTER AUTHORIZATION
--
-- Allows the trusted downloads trigger to increment
-- resources.download_count while preserving the resource
-- system-field protection for ordinary callers.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Update the trusted download-counter trigger function
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bump_download_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN

  -- Transaction-local marker identifying the operation as
  -- originating from this trusted download trigger.
  PERFORM set_config(
    'aneks.internal_download_counter',
    'true',
    true
  );

  UPDATE public.resources
  SET download_count = download_count + 1
  WHERE id = NEW.resource_id;

  RETURN NEW;

END;
$function$;


-- ------------------------------------------------------------
-- 2. Update resource protection trigger
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

  _internal_download_counter boolean :=
    COALESCE(
      current_setting(
        'aneks.internal_download_counter',
        true
      ),
      'false'
    ) = 'true';

BEGIN

  -- ----------------------------------------------------------
  -- Trusted internal download-counter operation
  --
  -- This operation may ONLY increment download_count by one
  -- on an existing approved, non-deleted resource.
  -- ----------------------------------------------------------

  IF _internal_download_counter THEN

    IF OLD.status <> 'approved'::public.resource_status
       OR OLD.deleted_at IS NOT NULL
    THEN
      RAISE EXCEPTION
        'Internal download counter requires an active approved resource';
    END IF;


    IF NEW.status <> 'approved'::public.resource_status
       OR NEW.deleted_at IS NOT NULL
    THEN
      RAISE EXCEPTION
        'Internal download counter cannot change resource lifecycle state';
    END IF;


    IF NEW.download_count IS DISTINCT FROM
       OLD.download_count + 1
    THEN
      RAISE EXCEPTION
        'Invalid internal download counter update';
    END IF;


    -- No resource field other than download_count may change.
    IF NEW.uploader_id IS DISTINCT FROM OLD.uploader_id
       OR NEW.category_id IS DISTINCT FROM OLD.category_id
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
       OR NEW.file_size IS DISTINCT FROM OLD.file_size
       OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
       OR NEW.thumbnail_path IS DISTINCT FROM OLD.thumbnail_path
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
       OR NEW.bookmark_count IS DISTINCT FROM OLD.bookmark_count
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.deleted_by IS DISTINCT FROM OLD.deleted_by
       OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
       OR NEW.rejected_by IS DISTINCT FROM OLD.rejected_by
       OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.college IS DISTINCT FROM OLD.college
       OR NEW.semester IS DISTINCT FROM OLD.semester
    THEN
      RAISE EXCEPTION
        'Internal download operation cannot modify protected resource fields';
    END IF;


    RETURN NEW;

  END IF;


  -- ----------------------------------------------------------
  -- Normal authenticated operation
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
  -- Ownership protection
  -- ----------------------------------------------------------

  IF NEW.uploader_id IS DISTINCT FROM OLD.uploader_id THEN
    RAISE EXCEPTION
      'You cannot change the resource uploader';
  END IF;


  -- ----------------------------------------------------------
  -- Download counter protection
  -- ----------------------------------------------------------

  IF NEW.download_count IS DISTINCT FROM OLD.download_count THEN
    RAISE EXCEPTION
      'You cannot change the download count';
  END IF;


  -- ----------------------------------------------------------
  -- Bookmark counter protection
  -- ----------------------------------------------------------

  IF NEW.bookmark_count IS DISTINCT FROM OLD.bookmark_count THEN
    RAISE EXCEPTION
      'You cannot change the bookmark count';
  END IF;


  -- ----------------------------------------------------------
  -- Creation timestamp protection
  -- ----------------------------------------------------------

  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION
      'You cannot change the creation timestamp';
  END IF;


  -- ----------------------------------------------------------
  -- Deletion metadata protection
  -- ----------------------------------------------------------

  IF NEW.deleted_by IS DISTINCT FROM OLD.deleted_by
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION
      'You cannot change deletion metadata';
  END IF;


  -- ----------------------------------------------------------
  -- Approval metadata
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
  -- Rejection metadata
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
  -- Lifecycle status protection
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
  -- File size protection
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
  -- Lecturer / Staff moderation boundary
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


-- ------------------------------------------------------------
-- 3. Keep internal trigger functions inaccessible directly
-- ------------------------------------------------------------

REVOKE ALL
ON FUNCTION public.bump_download_count()
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.bump_download_count()
FROM anon;

REVOKE ALL
ON FUNCTION public.bump_download_count()
FROM authenticated;


REVOKE ALL
ON FUNCTION public.protect_resource_system_fields()
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.protect_resource_system_fields()
FROM anon;

REVOKE ALL
ON FUNCTION public.protect_resource_system_fields()
FROM authenticated;