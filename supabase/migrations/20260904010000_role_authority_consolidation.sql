-- ============================================================
-- ANEKS LIBRARY — MIGRATION B2
-- ROLE AUTHORITY CONSOLIDATION
--
-- Canonical role authority:
--     public.profiles.primary_role
--
-- Compatibility:
--     public.user_roles
--
-- IMPORTANT:
--     user_roles is retained for compatibility with existing
--     application/database references, but it is no longer an
--     independent source of authorization truth.
--
-- DOES NOT:
--     - add roles
--     - remove roles
--     - change account_status
--     - change subscription logic
--     - change Storage policies
--     - change resources approval authorization
-- ============================================================


-- ============================================================
-- PART 1 — SYNCHRONIZE EXISTING user_roles FROM profiles
--
-- profiles.primary_role is authoritative.
--
-- Remove every existing compatibility role row first.
-- Then rebuild user_roles from profiles.primary_role.
--
-- This guarantees that:
--     - duplicate role rows are removed
--     - stale role rows are removed
--     - orphaned role rows are removed
--     - user_roles becomes an exact compatibility mirror
-- ============================================================

DELETE FROM public.user_roles;

INSERT INTO public.user_roles (
  user_id,
  role
)
SELECT
  p.id,
  p.primary_role
FROM public.profiles AS p
WHERE p.primary_role IS NOT NULL;


-- ============================================================
-- PART 2 — CANONICAL ROLE CHECK
--
-- has_role() reads ONLY profiles.primary_role.
--
-- user_roles is NOT consulted for authorization.
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_role(
  _user_id uuid,
  _role public.app_role
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE
      p.id = _user_id
      AND p.primary_role = _role
  );
$function$;


-- ============================================================
-- PART 3 — ADMIN AUTHORITY CHECKS
--
-- These functions continue to use has_role(), which now reads
-- profiles.primary_role exclusively.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin(
  _user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT public.has_role(
    _user_id,
    'admin'::public.app_role
  );
$function$;


CREATE OR REPLACE FUNCTION public.is_admin_or_coadmin(
  _user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT
    public.has_role(
      _user_id,
      'admin'::public.app_role
    )
    OR
    public.has_role(
      _user_id,
      'co-admin'::public.app_role
    );
$function$;


-- ============================================================
-- PART 4 — ROLE SYNCHRONIZATION FUNCTION
--
-- profiles.primary_role remains the source of truth.
--
-- Whenever a profile is inserted or its primary_role changes,
-- user_roles is rebuilt for that user.
--
-- SECURITY DEFINER is required because user_roles is protected
-- from direct client administration.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_user_role_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN

  -- Remove every compatibility role representation for this
  -- user before recreating the canonical representation.
  DELETE FROM public.user_roles
  WHERE user_id = NEW.id;


  -- Recreate the compatibility representation from the
  -- authoritative profile role.
  IF NEW.primary_role IS NOT NULL THEN
    INSERT INTO public.user_roles (
      user_id,
      role
    )
    VALUES (
      NEW.id,
      NEW.primary_role
    );
  END IF;


  RETURN NEW;
END;
$function$;


-- ============================================================
-- PART 5 — ROLE SYNCHRONIZATION TRIGGER
--
-- INSERT:
--     Creates the compatibility role row for a new profile.
--
-- UPDATE OF primary_role:
--     Replaces the old compatibility role with the new one.
-- ============================================================

DROP TRIGGER IF EXISTS sync_user_role_from_profile_trigger
ON public.profiles;


CREATE TRIGGER sync_user_role_from_profile_trigger
AFTER INSERT OR UPDATE OF primary_role
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_role_from_profile();


-- ============================================================
-- PART 6 — RE-SYNCHRONIZE AFTER TRIGGER CREATION
--
-- Ensures the live compatibility table exactly reflects
-- profiles.primary_role after the trigger has been installed.
--
-- Clearing the table also removes any stale or orphaned rows.
-- ============================================================

DELETE FROM public.user_roles;

INSERT INTO public.user_roles (
  user_id,
  role
)
SELECT
  p.id,
  p.primary_role
FROM public.profiles AS p
WHERE p.primary_role IS NOT NULL;


-- ============================================================
-- PART 7 — FUNCTION SECURITY
--
-- Client applications may call role-check functions only as
-- authenticated users.
--
-- The synchronization trigger function is never directly
-- executable by clients.
-- ============================================================

REVOKE ALL
ON FUNCTION public.has_role(
  uuid,
  public.app_role
)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.has_role(
  uuid,
  public.app_role
)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.has_role(
  uuid,
  public.app_role
)
TO authenticated;


REVOKE ALL
ON FUNCTION public.is_admin(uuid)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.is_admin(uuid)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.is_admin(uuid)
TO authenticated;


REVOKE ALL
ON FUNCTION public.is_admin_or_coadmin(uuid)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.is_admin_or_coadmin(uuid)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.is_admin_or_coadmin(uuid)
TO authenticated;


REVOKE ALL
ON FUNCTION public.sync_user_role_from_profile()
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.sync_user_role_from_profile()
FROM anon;

REVOKE ALL
ON FUNCTION public.sync_user_role_from_profile()
FROM authenticated;


-- ============================================================
-- END MIGRATION B2
-- ============================================================