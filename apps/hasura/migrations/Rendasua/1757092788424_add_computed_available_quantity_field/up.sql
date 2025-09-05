-- Create a function to compute available_quantity
CREATE OR REPLACE FUNCTION public.compute_available_quantity(business_inventory_row public.business_inventory)
RETURNS INTEGER AS $$
BEGIN
  RETURN business_inventory_row.quantity - business_inventory_row.reserved_quantity;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment for documentation
COMMENT ON FUNCTION public.compute_available_quantity(public.business_inventory) IS 'Computes available quantity as total quantity minus reserved quantity';
