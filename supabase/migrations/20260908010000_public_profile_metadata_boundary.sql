-- PRIV-001-03
-- Public profile metadata boundary.
--
-- Exposes only intentionally public profile fields through a
-- dedicated projection instead of the complete profiles table.
--
-- Existing profiles access is intentionally left unchanged in
-- this migration. Base-table access will be tightened only after
-- application consumers have been migrated and tested.

create or replace view public.public_profiles
with (security_barrier = true)
as
select
  p.id,
  p.full_name,
  p.bio,
  p.avatar_url,
  p.primary_role,
  p.reputation,
  p.created_at
from public.profiles as p;

revoke all on table public.public_profiles from anon, authenticated;

grant select on table public.public_profiles to anon, authenticated;