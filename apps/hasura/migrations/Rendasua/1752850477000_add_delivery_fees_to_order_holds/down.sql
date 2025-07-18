-- Remove delivery_fees column from order_holds table
ALTER TABLE order_holds 
DROP COLUMN IF EXISTS delivery_fees;
