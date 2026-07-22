-- =====================================================
-- Secure SECURITY DEFINER Functions
-- =====================================================

-- Remove execute permission from anonymous users
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)
FROM anon;

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid)
FROM anon;

-- Remove execute permission from authenticated users
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)
FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid)
FROM authenticated;

-- Allow only the database service role to execute directly
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)
TO service_role;

GRANT EXECUTE ON FUNCTION public.is_admin(uuid)
TO service_role;