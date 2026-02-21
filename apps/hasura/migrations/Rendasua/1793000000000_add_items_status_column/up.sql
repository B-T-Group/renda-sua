-- Create enum for item status (active vs soft-deleted)
CREATE TYPE public.item_status_enum AS ENUM ('active', 'deleted');

-- Add status column to items; default 'active' for existing and new rows
ALTER TABLE public.items
  ADD COLUMN status public.item_status_enum NOT NULL DEFAULT 'active';
