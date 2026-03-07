-- Add optional instructions field for "how to find" the address (e.g. landmarks, no postal codes in Africa)
ALTER TABLE public.addresses ADD COLUMN instructions TEXT;

COMMENT ON COLUMN public.addresses.instructions IS 'Optional extra information on how to find the location (e.g. landmarks, directions)';
