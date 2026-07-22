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