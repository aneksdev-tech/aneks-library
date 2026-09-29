-- Distinguish a completed Google registration from an Auth user
-- that was created by an ordinary Google login attempt.
--
-- Existing accounts are treated as already registered.
-- New Google accounts start incomplete and must complete the
-- registration-intent flow before they can remain in the system.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS google_registration_completed BOOLEAN
NOT NULL
DEFAULT true;


CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role public.app_role;
  v_status public.account_status;
  v_role_text TEXT;
  v_is_google BOOLEAN;
BEGIN
  v_is_google :=
    COALESCE(
      NEW.raw_app_meta_data->>'provider',
      ''
    ) = 'google';

  v_role_text := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'student'
  );

  BEGIN
    v_role := v_role_text::public.app_role;

    IF v_role = 'admin'::public.app_role THEN
      v_role := 'student'::public.app_role;
    END IF;

  EXCEPTION
    WHEN others THEN
      v_role := 'student'::public.app_role;
  END;

  v_status :=
    CASE
      WHEN v_is_google THEN
        'pending'::public.account_status

      WHEN v_role = 'student'::public.app_role THEN
        'active'::public.account_status

      WHEN v_role IN (
        'lecturer'::public.app_role,
        'staff'::public.app_role,
        'researcher'::public.app_role,
        'guest'::public.app_role,
        'co-admin'::public.app_role
      ) THEN
        'pending'::public.account_status

      ELSE
        'pending'::public.account_status
    END;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    college,
    department,
    level,
    primary_role,
    status,
    google_registration_completed
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      ''
    ),
    CASE
      WHEN v_role IN (
        'student'::public.app_role,
        'lecturer'::public.app_role,
        'staff'::public.app_role
      )
      THEN NEW.raw_user_meta_data->>'college'
    END,
    CASE
      WHEN v_role IN (
        'student'::public.app_role,
        'lecturer'::public.app_role,
        'staff'::public.app_role
      )
      THEN NEW.raw_user_meta_data->>'department'
    END,
    CASE
      WHEN v_role = 'student'::public.app_role
      THEN NEW.raw_user_meta_data->>'level'
    END,
    v_role,
    v_status,
    NOT v_is_google
  );

  INSERT INTO public.user_roles (
    user_id,
    role
  )
  VALUES (
    NEW.id,
    v_role
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.subscriptions (
    user_id,
    plan,
    status,
    started_at
  )
  VALUES (
    NEW.id,
    'free',
    'active',
    now()
  );

  RETURN NEW;
END;
$function$;


CREATE OR REPLACE FUNCTION public.mark_google_registration_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF current_setting(
       'app.internal_google_registration',
       true
     ) = 'ANEKS_GOOGLE_REGISTRATION_INTERNAL'
  THEN
    NEW.google_registration_completed := true;
  END IF;

  RETURN NEW;
END;
$function$;


DROP TRIGGER IF EXISTS trg_mark_google_registration_complete
ON public.profiles;


CREATE TRIGGER trg_mark_google_registration_complete
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.mark_google_registration_complete();


CREATE OR REPLACE FUNCTION public.cancel_unregistered_google_login()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _provider text;
  _registration_completed boolean;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT
    u.raw_app_meta_data->>'provider'
  INTO _provider
  FROM auth.users AS u
  WHERE u.id = _user_id;

  IF _provider IS DISTINCT FROM 'google' THEN
    RAISE EXCEPTION 'This operation is only available for Google accounts';
  END IF;

  SELECT
    p.google_registration_completed
  INTO _registration_completed
  FROM public.profiles AS p
  WHERE p.id = _user_id;

  IF _registration_completed IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Google registration is already completed';
  END IF;

  DELETE FROM auth.users
  WHERE id = _user_id;

  RETURN true;
END;
$function$;


REVOKE EXECUTE
ON FUNCTION public.cancel_unregistered_google_login()
FROM PUBLIC, anon;


GRANT EXECUTE
ON FUNCTION public.cancel_unregistered_google_login()
TO authenticated;