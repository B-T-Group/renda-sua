-- Allow admin moderation flow to record cleanup job source.
ALTER TYPE public.ai_image_cleanup_job_source ADD VALUE IF NOT EXISTS 'admin_moderation';
