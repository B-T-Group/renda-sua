-- Enum value must be committed before it can be used as a column default.
ALTER TYPE public.rental_listing_moderation_status ADD VALUE IF NOT EXISTS 'draft';
