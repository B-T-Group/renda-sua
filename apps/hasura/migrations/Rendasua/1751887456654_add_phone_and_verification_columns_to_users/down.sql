-- Remove the new columns from users table
ALTER TABLE public.users 
DROP COLUMN phone_number,
DROP COLUMN phone_number_verified,
DROP COLUMN email_verified;
