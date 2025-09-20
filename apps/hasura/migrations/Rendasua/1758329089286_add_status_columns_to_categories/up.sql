-- Add status column to item_categories table
ALTER TABLE public.item_categories 
ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active'));

-- Add status column to item_sub_categories table
ALTER TABLE public.item_sub_categories 
ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active'));

-- Create indexes for better performance
CREATE INDEX idx_item_categories_status ON public.item_categories(status);
CREATE INDEX idx_item_sub_categories_status ON public.item_sub_categories(status);
