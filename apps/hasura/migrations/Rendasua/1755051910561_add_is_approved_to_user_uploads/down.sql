-- Remove is_approved column from user_uploads table
DROP INDEX IF EXISTS idx_user_uploads_is_approved;
ALTER TABLE public.user_uploads DROP COLUMN IF EXISTS is_approved;
