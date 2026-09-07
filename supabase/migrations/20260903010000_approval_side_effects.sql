-- ============================================================
-- MIGRATION B3
-- Approval/rejection authority + approval side effects
-- ============================================================


-- ============================================================
-- PART 1: APPROVE RESOURCE
-- ============================================================
-- Authorized roles:
--   admin
--   co-admin
--   lecturer
--   staff
--
-- Side effect:
--   uploader receives +10 reputation when the resource
--   successfully transitions from pending -> approved.
--
-- The resource update and reputation update occur in the
-- same database transaction.
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
  _uploader_id uuid;
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


  IF _actor_role IS NULL THEN
    RAISE EXCEPTION
      'Your account is not authorized to approve resources';
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
      'You do not have permission to approve resources';
  END IF;


  -- ----------------------------------------------------------
  -- Load resource
  -- ----------------------------------------------------------
  SELECT
    r.status,
    r.uploader_id
  INTO
    _resource_status,
    _uploader_id
  FROM public.resources AS r
  WHERE
    r.id = _resource_id;


  IF _resource_status IS NULL THEN
    RAISE EXCEPTION 'Resource not found';
  END IF;


  -- ----------------------------------------------------------
  -- Only pending resources can be approved
  -- ----------------------------------------------------------
  IF _resource_status <> 'pending'::public.resource_status THEN
    RAISE EXCEPTION
      'Only pending resources can be approved';
  END IF;


  -- ----------------------------------------------------------
  -- Approve resource
  -- ----------------------------------------------------------
  UPDATE public.resources
  SET
    status = 'approved'::public.resource_status,
    approved_by = _actor_id,
    approved_at = clock_timestamp(),
    rejection_reason = NULL,
    deleted_at = NULL,
    deleted_by = NULL
  WHERE
    id = _resource_id
    AND status = 'pending'::public.resource_status;


  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Resource is no longer pending';
  END IF;


  -- ----------------------------------------------------------
  -- Award uploader reputation
  -- ----------------------------------------------------------
  UPDATE public.profiles
  SET
    reputation = COALESCE(reputation, 0) + 10
  WHERE
    id = _uploader_id;


  RETURN TRUE;

END;
$function$;


-- ============================================================
-- PART 2: REJECT RESOURCE
-- ============================================================
-- Authorized roles:
--   admin
--   co-admin
--   lecturer
--   staff
--
-- The frontend removes the pending resource file from Storage
-- before calling this function.
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
    rejection_reason = NULLIF(
      btrim(_rejection_reason),
      ''
    ),
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
-- PART 3: FUNCTION EXECUTION PRIVILEGES
-- ============================================================
-- Keep these RPCs unavailable to anonymous users and PUBLIC.
-- Only authenticated users can call them.
-- The functions themselves enforce the role authorization above.
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