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