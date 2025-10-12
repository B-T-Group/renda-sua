-- Add foreign key constraint for confirmed_by column in delivery_time_windows table
-- This fixes the confirmedByUser relationship issue

-- Add foreign key constraint to public.users table
ALTER TABLE public.delivery_time_windows 
ADD CONSTRAINT fk_delivery_time_windows_confirmed_by 
FOREIGN KEY (confirmed_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- Add comment
COMMENT ON CONSTRAINT fk_delivery_time_windows_confirmed_by ON public.delivery_time_windows 
IS 'Foreign key constraint linking confirmed_by to public.users table for confirmedByUser relationship';
