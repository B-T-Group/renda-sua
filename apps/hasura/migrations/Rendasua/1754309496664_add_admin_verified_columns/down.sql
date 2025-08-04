-- Remove is_admin and is_verified columns from businesses table
ALTER TABLE public.businesses 
DROP COLUMN is_admin,
DROP COLUMN is_verified;

-- Remove is_verified column from agents table
ALTER TABLE public.agents 
DROP COLUMN is_verified;
