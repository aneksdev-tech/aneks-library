-- ============================================================
-- ANEKS LIBRARY — MIGRATION A
-- APPROVALS AUTHORIZATION
--
-- Purpose:
--   1. Allow active Lecturers and Staff to view pending resources.
--   2. Allow active Lecturers and Staff to approve/reject resources
--      through narrowly scoped SECURITY DEFINER RPCs.
--   3. Prevent Lecturers/Staff from receiving broad UPDATE authority.
--   4. Preserve existing Admin/Co-admin full resource authority.
--   5. Preserve existing uploader policies.
--
-- Does NOT modify:
--   - profiles RLS
--   - user_roles RLS
--   - Storage policies
--   - Categories
--   - Users
--   - subscription logic
--   - role enum values
--   - existing admin/co-admin resource policy
--   - existing uploader policies
-- ============================================================


-- ============================================================
-- 1. Allow active Lecturers and Staff to view pending resources
-- ============================================================

DROP POLICY IF EXISTS "Lecturers and staff view pending resources"
ON public.resources;

CREATE POLICY "Lecturers and staff view pending resources"
ON public.resources
FOR SELECT
TO authenticated
USING (
  status = 'pending'::public.resource_status
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.status = 'active'::public.account_status
      AND profiles.primary_role IN (
        'lecturer'::public.app_role,
        'staff'::public.app_role
      )
  )
);


-- ============================================================
-- 2. Approve resource RPC
--
-- Only active Lecturers and Staff may call this.
-- Admin/Co-admin are intentionally not required to use it;
-- their existing ALL resource policy remains untouched.
--
-- Only approval-related columns are changed.
-- ============================================================

CREATE OR REPLACE FUNCTION public.approve_resource(
  _resource_id uuid
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
  -- Verify active Lecturer/Staff actor
  -- ----------------------------------------------------------

  SELECT p.primary_role
  INTO _actor_role
  FROM public.profiles AS p
  WHERE p.id = _actor_id
    AND p.status = 'active'::public.account_status;

  IF _actor_role IS NULL THEN
    RAISE EXCEPTION 'Your account is not authorized to approve resources';
  END IF;

  IF _actor_role NOT IN (
    'lecturer'::public.app_role,
    'staff'::public.app_role
  ) THEN
    RAISE EXCEPTION 'You do not have permission to approve resources';
  END IF;


  -- ----------------------------------------------------------
  -- Verify target resource
  -- ----------------------------------------------------------

  SELECT r.status
  INTO _resource_status
  FROM public.resources AS r
  WHERE r.id = _resource_id;

  IF _resource_status IS NULL THEN
    RAISE EXCEPTION 'Resource not found';
  END IF;


  -- ----------------------------------------------------------
  -- Only pending resources can be approved.
  -- ----------------------------------------------------------

  IF _resource_status <> 'pending'::public.resource_status THEN
    RAISE EXCEPTION 'Only pending resources can be approved';
  END IF;


  -- ----------------------------------------------------------
  -- Approve.
  --
  -- Deliberately update only approval/lifecycle fields.
  -- Title, description, category, file path, uploader, etc.
  -- cannot be changed through this function.
  -- ----------------------------------------------------------

  UPDATE public.resources
  SET
    status = 'approved'::public.resource_status,
    approved_by = _actor_id,
    approved_at = clock_timestamp(),
    rejection_reason = NULL,
    deleted_at = NULL,
    deleted_by = NULL
  WHERE id = _resource_id
    AND status = 'pending'::public.resource_status;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resource is no longer pending';
  END IF;

  RETURN TRUE;
END;
$function$;


-- ============================================================
-- 3. Reject resource RPC
--
-- Only active Lecturers and Staff may call this.
-- Only rejection-related database fields are changed.
-- ============================================================

CREATE OR REPLACE FUNCTION public.reject_resource(
  _resource_id uuid,
  _rejection_reason text DEFAULT NULL
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
  -- Verify active Lecturer/Staff actor
  -- ----------------------------------------------------------

  SELECT p.primary_role
  INTO _actor_role
  FROM public.profiles AS p
  WHERE p.id = _actor_id
    AND p.status = 'active'::public.account_status;

  IF _actor_role IS NULL THEN
    RAISE EXCEPTION 'Your account is not authorized to reject resources';
  END IF;

  IF _actor_role NOT IN (
    'lecturer'::public.app_role,
    'staff'::public.app_role
  ) THEN
    RAISE EXCEPTION 'You do not have permission to reject resources';
  END IF;


  -- ----------------------------------------------------------
  -- Verify target resource
  -- ----------------------------------------------------------

  SELECT r.status
  INTO _resource_status
  FROM public.resources AS r
  WHERE r.id = _resource_id;

  IF _resource_status IS NULL THEN
    RAISE EXCEPTION 'Resource not found';
  END IF;


  -- ----------------------------------------------------------
  -- Only pending resources can be rejected.
  -- ----------------------------------------------------------

  IF _resource_status <> 'pending'::public.resource_status THEN
    RAISE EXCEPTION 'Only pending resources can be rejected';
  END IF;


  -- ----------------------------------------------------------
  -- Reject.
  --
  -- Only rejection/lifecycle fields are changed.
  -- ----------------------------------------------------------

  UPDATE public.resources
  SET
    status = 'rejected'::public.resource_status,
    rejection_reason = NULLIF(
      btrim(_rejection_reason),
      ''
    ),
    approved_by = NULL,
    approved_at = NULL,
    deleted_at = NULL,
    deleted_by = NULL
  WHERE id = _resource_id
    AND status = 'pending'::public.resource_status;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resource is no longer pending';
  END IF;

  RETURN TRUE;
END;
$function$;


-- ============================================================
-- 4. Restrict RPC execution
--
-- These are privileged SECURITY DEFINER functions.
-- Anonymous users must not be able to execute them.
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
-- END MIGRATION A
-- ============================================================