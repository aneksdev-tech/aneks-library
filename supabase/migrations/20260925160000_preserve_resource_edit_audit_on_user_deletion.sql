-- Preserve resource edit audit history when an account is deleted.
--
-- The audit record remains intact, while the actor reference is cleared.
-- This prevents account deletion from being blocked by audit history.

ALTER TABLE public.resource_edit_audit_logs
ALTER COLUMN edited_by DROP NOT NULL;


ALTER TABLE public.resource_edit_audit_logs
DROP CONSTRAINT resource_edit_audit_logs_edited_by_fkey;


ALTER TABLE public.resource_edit_audit_logs
ADD CONSTRAINT resource_edit_audit_logs_edited_by_fkey
FOREIGN KEY (edited_by)
REFERENCES public.profiles(id)
ON DELETE SET NULL;