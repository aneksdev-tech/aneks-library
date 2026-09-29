/*
  Google Registration Authorization
  ---------------------------------

  Google registration flow:

    1. Browser creates a short-lived registration intent.
    2. Browser starts Google OAuth.
    3. Supabase creates the auth.users record.
    4. handle_new_user() creates the profile as pending.
    5. Browser returns to /auth.
    6. Browser calls complete_google_registration().
    7. The RPC validates the intent + Google account.
    8. The RPC applies the selected registration data.
    9. Student -> active.
       Lecturer/Staff/Researcher/Guest -> pending.

  Security:
    - Self-registration is limited to the five allowed roles.
    - Admin/co-admin cannot be self-selected.
    - The registration intent expires after 15 minutes.
    - The intent can only be consumed once.
    - The Google account must have been created after the intent.
    - Existing users cannot use this flow to change their role/status.
    - Existing profile self-change protection remains active.
*/

BEGIN;


/* -------------------------------------------------------------------------- */
/* 1. Registration intent table                                               */
/* -------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS public.google_registration_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  nonce uuid NOT NULL UNIQUE,

  role public.app_role NOT NULL,

  college text,
  department text,
  level text,

  created_at timestamptz NOT NULL DEFAULT now(),

  expires_at timestamptz NOT NULL
    DEFAULT (now() + interval '15 minutes'),

  consumed_at timestamptz
);


/* -------------------------------------------------------------------------- */
/* 2. Registration role protection                                            */
/* -------------------------------------------------------------------------- */

ALTER TABLE public.google_registration_intents
  DROP CONSTRAINT IF EXISTS google_registration_intents_role_check;

ALTER TABLE public.google_registration_intents
  ADD CONSTRAINT google_registration_intents_role_check
  CHECK (
    role IN (
      'student'::public.app_role,
      'lecturer'::public.app_role,
      'staff'::public.app_role,
      'researcher'::public.app_role,
      'guest'::public.app_role
    )
  );


/* -------------------------------------------------------------------------- */
/* 3. Registration-intent indexes                                             */
/* -------------------------------------------------------------------------- */

CREATE INDEX IF NOT EXISTS
  google_registration_intents_nonce_idx
ON public.google_registration_intents (nonce);

CREATE INDEX IF NOT EXISTS
  google_registration_intents_expiry_idx
ON public.google_registration_intents (expires_at)
WHERE consumed_at IS NULL;


/* -------------------------------------------------------------------------- */
/* 4. RLS                                                                     */
/* -------------------------------------------------------------------------- */

ALTER TABLE public.google_registration_intents ENABLE ROW LEVEL SECURITY;


/*
  There are intentionally no direct table policies.

  The table is accessed through the controlled RPCs below.
*/


/* -------------------------------------------------------------------------- */
/* 5. Create Google registration intent                                      */
/* -------------------------------------------------------------------------- */

CREATE OR REPLACE FUNCTION public.create_google_registration_intent(
  _nonce uuid,
  _role public.app_role,
  _college text DEFAULT NULL,
  _department text DEFAULT NULL,
  _level text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  _trimmed_college text;
  _trimmed_department text;
  _trimmed_level text;
BEGIN

  /*
    The intent creation endpoint is deliberately callable before
    authentication because the user does not exist yet.

    The role is nevertheless restricted to normal self-registration roles.
  */

  IF _role NOT IN (
    'student'::public.app_role,
    'lecturer'::public.app_role,
    'staff'::public.app_role,
    'researcher'::public.app_role,
    'guest'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Invalid registration role';
  END IF;


  IF _nonce IS NULL THEN
    RAISE EXCEPTION 'Registration nonce is required';
  END IF;


  _trimmed_college :=
    NULLIF(btrim(_college), '');

  _trimmed_department :=
    NULLIF(btrim(_department), '');

  _trimmed_level :=
    NULLIF(btrim(_level), '');


  /*
    Student, lecturer and staff require academic affiliation.
  */
  IF _role IN (
    'student'::public.app_role,
    'lecturer'::public.app_role,
    'staff'::public.app_role
  ) THEN

    IF _trimmed_college IS NULL THEN
      RAISE EXCEPTION 'College is required for this registration role';
    END IF;

    IF _trimmed_department IS NULL THEN
      RAISE EXCEPTION 'Department is required for this registration role';
    END IF;

  END IF;


  /*
    Only students require level.
  */
  IF _role = 'student'::public.app_role
     AND _trimmed_level IS NULL THEN
    RAISE EXCEPTION 'Level is required for student registration';
  END IF;


  /*
    Non-students do not need level.
  */
  IF _role <> 'student'::public.app_role THEN
    _trimmed_level := NULL;
  END IF;


  /*
    Researcher and guest do not use academic affiliation.
  */
  IF _role IN (
    'researcher'::public.app_role,
    'guest'::public.app_role
  ) THEN

    _trimmed_college := NULL;
    _trimmed_department := NULL;

  END IF;


  INSERT INTO public.google_registration_intents (
    nonce,
    role,
    college,
    department,
    level
  )
  VALUES (
    _nonce,
    _role,
    _trimmed_college,
    _trimmed_department,
    _trimmed_level
  );


  RETURN true;

END;
$function$;


/* -------------------------------------------------------------------------- */
/* 6. Complete Google registration                                           */
/* -------------------------------------------------------------------------- */

CREATE OR REPLACE FUNCTION public.complete_google_registration(
  _nonce uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  _user_id uuid;

  _user_created_at timestamptz;
  _provider text;

  _intent_id uuid;
  _intent_created_at timestamptz;

  _role public.app_role;
  _status public.account_status;

  _college text;
  _department text;
  _level text;
BEGIN

  /* ---------------------------------------------------------------------- */
  /* Authentication                                                          */
  /* ---------------------------------------------------------------------- */

  _user_id := auth.uid();

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;


  /* ---------------------------------------------------------------------- */
  /* Verify Google provider                                                 */
  /* ---------------------------------------------------------------------- */

  SELECT
    u.created_at,
    u.raw_app_meta_data->>'provider'
  INTO
    _user_created_at,
    _provider
  FROM auth.users u
  WHERE u.id = _user_id;


  IF _user_created_at IS NULL THEN
    RAISE EXCEPTION 'Authenticated user not found';
  END IF;


  IF _provider <> 'google' THEN
    RAISE EXCEPTION
      'This registration flow is only available for Google accounts';
  END IF;


  /* ---------------------------------------------------------------------- */
  /* Retrieve and lock intent                                               */
  /* ---------------------------------------------------------------------- */

  SELECT
    gri.id,
    gri.created_at,
    gri.role,
    gri.college,
    gri.department,
    gri.level
  INTO
    _intent_id,
    _intent_created_at,
    _role,
    _college,
    _department,
    _level
  FROM public.google_registration_intents gri
  WHERE gri.nonce = _nonce
    AND gri.consumed_at IS NULL
    AND gri.expires_at > now()
  FOR UPDATE;


  IF _intent_id IS NULL THEN
    RAISE EXCEPTION
      'Registration request is invalid or has expired';
  END IF;


  /* ---------------------------------------------------------------------- */
  /* Bind intent to a newly-created Google account                          */
  /* ---------------------------------------------------------------------- */

  /*
    The Google account must have been created after the registration
    intent was created.

    This prevents an existing Google account from using an arbitrary
    registration intent to change its own role or status.
  */
  IF _user_created_at < _intent_created_at THEN
    RAISE EXCEPTION
      'This Google account is not eligible for this registration request';
  END IF;


  /*
    Prevent an intent from being used far outside its original creation
    window even if the Auth account timestamp has unusual clock behavior.
  */
  IF _user_created_at > _intent_created_at + interval '15 minutes' THEN
    RAISE EXCEPTION
      'Registration request is no longer valid for this account';
  END IF;


  /* ---------------------------------------------------------------------- */
  /* Verify current profile                                                  */
  /* ---------------------------------------------------------------------- */

  PERFORM 1
  FROM public.profiles p
  WHERE p.id = _user_id
    AND p.status = 'pending'
  FOR UPDATE;


  IF NOT FOUND THEN
    RAISE EXCEPTION
      'This account is not awaiting Google registration completion';
  END IF;


  /* ---------------------------------------------------------------------- */
  /* Determine final account status                                          */
  /* ---------------------------------------------------------------------- */

  _status :=
    CASE
      WHEN _role = 'student'::public.app_role
        THEN 'active'::public.account_status

      ELSE
        'pending'::public.account_status
    END;


  /* ---------------------------------------------------------------------- */
  /* Trusted protected-profile update                                        */
  /* ---------------------------------------------------------------------- */

  /*
    The existing profile trigger prevents users from changing their own
    role/status.

    This transaction-local setting is used only by this trusted
    SECURITY DEFINER operation.

    It is NOT exposed as an RPC or client-callable function argument.
    The value is set internally by this trusted SECURITY DEFINER
    function for the duration of the current transaction.
  */
  PERFORM set_config(
    'app.internal_google_registration',
    'ANEKS_GOOGLE_REGISTRATION_INTERNAL',
    true
  );


  UPDATE public.profiles
  SET
    primary_role = _role,

    status = _status,

    college =
      CASE
        WHEN _role IN (
          'student'::public.app_role,
          'lecturer'::public.app_role,
          'staff'::public.app_role
        )
        THEN _college
        ELSE NULL
      END,

    department =
      CASE
        WHEN _role IN (
          'student'::public.app_role,
          'lecturer'::public.app_role,
          'staff'::public.app_role
        )
        THEN _department
        ELSE NULL
      END,

    level =
      CASE
        WHEN _role = 'student'::public.app_role
        THEN _level
        ELSE NULL
      END

  WHERE id = _user_id;


  /* ---------------------------------------------------------------------- */
  /* Synchronize user_roles                                                  */
  /* ---------------------------------------------------------------------- */

  DELETE FROM public.user_roles
  WHERE user_id = _user_id;


  INSERT INTO public.user_roles (
    user_id,
    role
  )
  VALUES (
    _user_id,
    _role
  )
  ON CONFLICT (user_id, role) DO NOTHING;


  /* ---------------------------------------------------------------------- */
  /* Consume intent                                                         */
  /* ---------------------------------------------------------------------- */

  UPDATE public.google_registration_intents
  SET consumed_at = now()
  WHERE id = _intent_id;


  RETURN true;

END;
$function$;


/* -------------------------------------------------------------------------- */
/* 7. Update existing protection function                                    */
/* -------------------------------------------------------------------------- */

CREATE OR REPLACE FUNCTION public.prevent_protected_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN

  /*
    Trusted Google registration update.

    The value is set only inside complete_google_registration()
    and is transaction-local.
  */
  IF current_setting(
    'app.internal_google_registration',
    true
  ) = 'ANEKS_GOOGLE_REGISTRATION_INTERNAL' THEN
    RETURN NEW;
  END IF;


  /*
    Existing service-role bypass remains unchanged.
  */
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;


  /*
    Existing self-modification protection remains unchanged.
  */
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
$function$;


/* -------------------------------------------------------------------------- */
/* 8. Update handle_new_user()                                               */
/* -------------------------------------------------------------------------- */

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role;
  v_status public.account_status;
  v_role_text text;
  v_provider text;
BEGIN

  v_role_text := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'student'
  );


  /*
    Google OAuth does not provide the selected Aneks role through
    signInWithOAuth(). Therefore Google-created accounts start as
    pending and are finalized by complete_google_registration().
  */
  v_provider :=
    NEW.raw_app_meta_data->>'provider';


  BEGIN

    v_role := v_role_text::public.app_role;

    /*
      Never allow admin self-registration.
    */
    IF v_role = 'admin'::public.app_role THEN
      v_role := 'student'::public.app_role;
    END IF;

    /*
      Never allow co-admin self-registration.
    */
    IF v_role = 'co-admin'::public.app_role THEN
      v_role := 'student'::public.app_role;
    END IF;

  EXCEPTION
    WHEN others THEN
      v_role := 'student'::public.app_role;
  END;


  /*
    Google accounts must remain pending until the selected
    registration intent has been securely consumed.
  */
  IF v_provider = 'google' THEN

    v_status :=
      'pending'::public.account_status;

  ELSE

    v_status :=
      CASE
        WHEN v_role = 'student'::public.app_role
          THEN 'active'::public.account_status

        WHEN v_role IN (
          'lecturer'::public.app_role,
          'staff'::public.app_role,
          'researcher'::public.app_role,
          'guest'::public.app_role,
          'co-admin'::public.app_role
        )
          THEN 'pending'::public.account_status

        ELSE
          'pending'::public.account_status
      END;

  END IF;


  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    college,
    department,
    level,
    primary_role,
    status
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
    v_status
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


/* -------------------------------------------------------------------------- */
/* 9. Function permissions                                                    */
/* -------------------------------------------------------------------------- */

REVOKE ALL
ON FUNCTION public.create_google_registration_intent(
  uuid,
  public.app_role,
  text,
  text,
  text
)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.complete_google_registration(uuid)
FROM PUBLIC;


/*
  Intent creation happens before authentication.
*/
GRANT EXECUTE
ON FUNCTION public.create_google_registration_intent(
  uuid,
  public.app_role,
  text,
  text,
  text
)
TO anon;


/*
  Completion happens after Google OAuth has authenticated the user.
*/
GRANT EXECUTE
ON FUNCTION public.complete_google_registration(uuid)
TO authenticated;


/* -------------------------------------------------------------------------- */
/* 10. Remove direct table access                                             */
/* -------------------------------------------------------------------------- */

REVOKE ALL
ON public.google_registration_intents
FROM anon, authenticated;


/* -------------------------------------------------------------------------- */
/* 11. Cleanup expired intents                                                */
/* -------------------------------------------------------------------------- */

CREATE OR REPLACE FUNCTION public.cleanup_expired_google_registration_intents()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_deleted integer;
BEGIN

  DELETE FROM public.google_registration_intents
  WHERE
    (
      consumed_at IS NULL
      AND expires_at < now()
    )
    OR
    (
      consumed_at IS NOT NULL
      AND consumed_at < now() - interval '1 day'
    );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN v_deleted;

END;
$function$;


REVOKE ALL
ON FUNCTION public.cleanup_expired_google_registration_intents()
FROM PUBLIC;


COMMIT;