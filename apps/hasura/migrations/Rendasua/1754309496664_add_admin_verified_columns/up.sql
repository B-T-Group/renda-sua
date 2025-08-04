-- Add is_admin and is_verified columns to businesses table
ALTER TABLE public.businesses 
ADD COLUMN is_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;

-- Add is_verified column to agents table
ALTER TABLE public.agents 
ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;

-- Add comments for documentation
COMMENT ON COLUMN public.businesses.is_admin IS 'Indicates if the business has admin privileges';
COMMENT ON COLUMN public.businesses.is_verified IS 'Indicates if the business account has been verified';
COMMENT ON COLUMN public.agents.is_verified IS 'Indicates if the agent account has been verified';
