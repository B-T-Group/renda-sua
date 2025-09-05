-- Force drop the available_quantity column if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'business_inventory' 
        AND column_name = 'available_quantity'
    ) THEN
        ALTER TABLE public.business_inventory DROP COLUMN available_quantity;
    END IF;
END $$;
