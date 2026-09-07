-- ============================================================
-- Aneks Library
-- Public Resource Metadata Boundary
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Remove anonymous access to the underlying resources table.
--
-- The historical RLS policy:
--   "Approved resources public read"
--
-- remains in the migration history/database, but anon can no
-- longer reach the table because the SELECT privilege is removed.
-- ------------------------------------------------------------

REVOKE SELECT ON TABLE public.resources FROM anon;

-- ------------------------------------------------------------
-- 2. Recreate the public metadata-only projection.
--
-- IMPORTANT:
-- This view intentionally exposes metadata only.
--
-- It does NOT expose:
--   file_path
--   file_name
--   file_size
--   mime_type
--   thumbnail_path
--   uploader_id
--   approved_by
--   approved_at
--   rejection_reason
--   deleted_by
--   deleted_at
--   rejected_by
--   rejected_at
-- ------------------------------------------------------------

DROP VIEW IF EXISTS public.public_resources;

CREATE VIEW public.public_resources
WITH (security_barrier = true)
AS
SELECT
  r.id,
  r.title,
  r.description,
  r.course_code,
  r.college,
  r.department,
  r.level,
  r.semester,
  r.year,
  r.tags,
  r.category_id,
  r.download_count,
  r.bookmark_count,
  r.created_at,

  -- Safe derived file type for the Library UI.
  CASE
    WHEN position('.' IN reverse(r.file_name)) > 0
      THEN lower(
        substring(
          r.file_name
          FROM length(r.file_name) - position('.' IN reverse(r.file_name)) + 2
        )
      )
    ELSE NULL
  END AS file_type,

  c.name AS category_name,
  c.slug AS category_slug

FROM public.resources AS r
LEFT JOIN public.categories AS c
  ON c.id = r.category_id

WHERE r.status = 'approved'::public.resource_status
  AND r.deleted_at IS NULL;

-- ------------------------------------------------------------
-- 3. Expose only the metadata projection through the Data API.
-- ------------------------------------------------------------

GRANT SELECT ON TABLE public.public_resources TO anon;
GRANT SELECT ON TABLE public.public_resources TO authenticated;

COMMIT;