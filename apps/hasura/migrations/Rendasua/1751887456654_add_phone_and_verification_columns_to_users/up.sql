-- Add new columns to users table
ALTER TABLE public.users 
ADD COLUMN phone_number VARCHAR(20),
ADD COLUMN phone_number_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;

-- Add comments for documentation
COMMENT ON COLUMN public.users.phone_number IS 'User phone number for contact and verification';
COMMENT ON COLUMN public.users.phone_number_verified IS 'Whether the phone number has been verified';
COMMENT ON COLUMN public.users.email_verified IS 'Whether the email has been verified';
