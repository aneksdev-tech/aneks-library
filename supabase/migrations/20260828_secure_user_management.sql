-- ============================================================
-- ANEKS LIBRARY
-- Phase 1 — Secure User Management
-- ============================================================

-- ============================================================
-- 1. Helper: active admin/co-admin
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_manage_users(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND status = 'active'::public.account_status
      AND primary_role IN (
        'admin'::public.app_role,
        'co-admin'::public.app_role
      )
  );
$$;


-- ============================================================
-- 2. Remove the old unrestricted self-update policy
-- ============================================================

DROP POLICY IF EXISTS "Users update own profile"
ON public.profiles;


-- ============================================================
-- 3. Safe self-profile updates
--
-- Users can edit their own normal profile information,
-- but cannot change role or account status.
-- ============================================================

CREATE POLICY "Users update own profile safely"
ON public.profiles
FOR UPDATE
USING (
  auth.uid() = id
)
WITH CHECK (
  auth.uid() = id
  AND primary_role = (
    SELECT primary_role
    FROM public.profiles
    WHERE id = auth.uid()
  )
  AND status = (
    SELECT status
    FROM public.profiles
    WHERE id = auth.uid()
  )
);


-- ============================================================
-- 4. Secure status-change RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_set_user_status(
  _target_user_id UUID,
  _new_status public.account_status
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_id UUID := auth.uid();
  _actor_role public.app_role;
  _target_role public.app_role;
BEGIN

  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT primary_role
  INTO _actor_role
  FROM public.profiles
  WHERE id = _actor_id
    AND status = 'active'::public.account_status;

  IF _actor_role IS NULL THEN
    RAISE EXCEPTION 'Your account is not authorized to manage users';
  END IF;

  IF _actor_role NOT IN (
    'admin'::public.app_role,
    'co-admin'::public.app_role
  ) THEN
    RAISE EXCEPTION 'You do not have permission to manage users';
  END IF;

  SELECT primary_role
  INTO _target_role
  FROM public.profiles
  WHERE id = _target_user_id;

  IF _target_role IS NULL THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  -- Prevent self-suspension, self-rejection, self-deactivation, etc.
  IF _actor_id = _target_user_id THEN
    RAISE EXCEPTION 'You cannot change your own account status';
  END IF;

  -- Co-admins cannot modify administrators.
  IF _actor_role = 'co-admin'::public.app_role
     AND _target_role = 'admin'::public.app_role THEN
    RAISE EXCEPTION 'Co-admins cannot modify an administrator';
  END IF;

  UPDATE public.profiles
  SET status = _new_status
  WHERE id = _target_user_id;

  RETURN TRUE;
END;
$$;


-- ============================================================
-- 5. Secure role-change RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  _target_user_id UUID,
  _new_role public.app_role
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_id UUID := auth.uid();
  _actor_role public.app_role;
  _target_role public.app_role;
BEGIN

  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT primary_role
  INTO _actor_role
  FROM public.profiles
  WHERE id = _actor_id
    AND status = 'active'::public.account_status;

  IF _actor_role IS NULL THEN
    RAISE EXCEPTION 'Your account is not authorized to manage users';
  END IF;

  IF _actor_role NOT IN (
    'admin'::public.app_role,
    'co-admin'::public.app_role
  ) THEN
    RAISE EXCEPTION 'You do not have permission to manage users';
  END IF;

  SELECT primary_role
  INTO _target_role
  FROM public.profiles
  WHERE id = _target_user_id;

  IF _target_role IS NULL THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  -- Prevent self-demotion or self-promotion.
  IF _actor_id = _target_user_id THEN
    RAISE EXCEPTION 'You cannot change your own role';
  END IF;

  -- Only admin can modify another administrator.
  IF _target_role = 'admin'::public.app_role
     AND _actor_role <> 'admin'::public.app_role THEN
    RAISE EXCEPTION 'Only an administrator can modify an administrator';
  END IF;

  -- Co-admin cannot create another administrator.
  IF _actor_role = 'co-admin'::public.app_role
     AND _new_role = 'admin'::public.app_role THEN
    RAISE EXCEPTION 'Co-admins cannot promote users to administrator';
  END IF;

  UPDATE public.profiles
  SET primary_role = _new_role
  WHERE id = _target_user_id;

  RETURN TRUE;
END;
$$;


-- ============================================================
-- 6. Permissions
-- ============================================================

GRANT EXECUTE ON FUNCTION public.admin_set_user_status(
  UUID,
  public.account_status
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.admin_set_user_role(
  UUID,
  public.app_role
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.can_manage_users(UUID)
TO authenticated;


-- ============================================================
-- 7. Prevent direct self-modification of security fields
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_protected_profile_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN

  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.id THEN

    IF NEW.primary_role IS DISTINCT FROM OLD.primary_role THEN
      RAISE EXCEPTION 'Users cannot change their own role';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Users cannot change their own account status';
    END IF;

  END IF;

  RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS trg_protect_profile_security_fields
ON public.profiles;

CREATE TRIGGER trg_protect_profile_security_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_protected_profile_changes();


-- ============================================================
-- END OF PHASE 1 DATABASE SECURITY
-- ============================================================