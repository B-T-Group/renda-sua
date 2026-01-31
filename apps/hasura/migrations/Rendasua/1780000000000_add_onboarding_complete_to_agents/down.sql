-- Remove onboarding_complete column from agents table
ALTER TABLE public.agents DROP COLUMN IF EXISTS onboarding_complete;
