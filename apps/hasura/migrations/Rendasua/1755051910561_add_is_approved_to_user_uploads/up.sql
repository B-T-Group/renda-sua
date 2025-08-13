-- Add is_approved column to user_uploads table
ALTER TABLE public.user_uploads 
ADD COLUMN is_approved BOOLEAN NOT NULL DEFAULT false;

-- Create index for better performance on approval queries
CREATE INDEX idx_user_uploads_is_approved ON public.user_uploads(is_approved);
