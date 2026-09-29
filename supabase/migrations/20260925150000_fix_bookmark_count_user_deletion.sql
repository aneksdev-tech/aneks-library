-- Allow bookmark counter synchronization during trusted system operations
-- such as cascading deletion of an Auth user.
--
-- Normal resource updates remain protected by
-- protect_resource_system_fields().

CREATE OR REPLACE FUNCTION public.sync_bookmark_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Mark this transaction as a trusted bookmark-counter operation.
  PERFORM set_config(
    'app.internal_bookmark_count_sync',
    'ANEKS_BOOKMARK_COUNT_SYNC_INTERNAL',
    true
  );

  IF TG_OP = 'INSERT' THEN
    UPDATE public.resources
    SET bookmark_count = bookmark_count + 1
    WHERE id = NEW.resource_id;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.resources
    SET bookmark_count = GREATEST(bookmark_count - 1, 0)
    WHERE id = OLD.resource_id;
  END IF;

  RETURN NULL;
END;
$function$;


CREATE OR REPLACE FUNCTION public.protect_resource_system_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _actor_id uuid := auth.uid();
  _actor_role public.app_role;
  _bookmark_sync boolean :=
    current_setting(
      'app.internal_bookmark_count_sync',
      true
    ) = 'ANEKS_BOOKMARK_COUNT_SYNC_INTERNAL';
BEGIN
  /*
    Bookmark-count synchronization is a trusted internal operation
    performed by sync_bookmark_count().

    It is intentionally limited to changing bookmark_count only.
  */
  IF _bookmark_sync THEN
    IF NEW.bookmark_count IS DISTINCT FROM OLD.bookmark_count
       AND NEW.uploader_id IS NOT DISTINCT FROM OLD.uploader_id
       AND NEW.download_count IS NOT DISTINCT FROM OLD.download_count
       AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
       AND NEW.deleted_by IS NOT DISTINCT FROM OLD.deleted_by
       AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at
       AND NEW.deletion_reason IS NOT DISTINCT FROM OLD.deletion_reason
       AND NEW.approved_by IS NOT DISTINCT FROM OLD.approved_by
       AND NEW.approved_at IS NOT DISTINCT FROM OLD.approved_at
       AND NEW.rejected_by IS NOT DISTINCT FROM OLD.rejected_by
       AND NEW.rejected_at IS NOT DISTINCT FROM OLD.rejected_at
       AND NEW.rejection_reason IS NOT DISTINCT FROM OLD.rejection_reason
       AND NEW.status IS NOT DISTINCT FROM OLD.status
       AND NEW.file_size IS NOT DISTINCT FROM OLD.file_size
    THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION
      'Bookmark synchronization may only change bookmark_count';
  END IF;

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
      RAISE EXCEPTION
        'Moderation cannot modify resource content or ownership';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;