-- ==========================================================
-- ANEKS LIBRARY
-- Subscription System v1.0
-- ==========================================================

-- Add subscription fields to the profiles table

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subscription_start TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMPTZ;


-- =====================================================
-- Fix Public Profile Exposure
-- =====================================================

DROP POLICY IF EXISTS "Profiles are viewable by everyone"
ON public.profiles;

-- Users can view only their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (
    auth.uid() = id
);

-- Admins can view every profile
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (
    public.is_admin(auth.uid())
);





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