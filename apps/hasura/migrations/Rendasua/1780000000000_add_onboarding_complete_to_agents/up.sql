-- Add onboarding_complete column to agents table
-- This column tracks whether the agent has completed the onboarding flow
ALTER TABLE public.agents 
ADD COLUMN onboarding_complete boolean NOT NULL DEFAULT false;

-- Add comment explaining the column
COMMENT ON COLUMN public.agents.onboarding_complete IS 'Tracks whether the agent has completed the onboarding tutorial flow';
