-- Add delivery_fees column to order_holds table
ALTER TABLE order_holds 
ADD COLUMN delivery_fees DECIMAL(10,2) DEFAULT 0.00 NOT NULL;

-- Add comment to document the column purpose
COMMENT ON COLUMN order_holds.delivery_fees IS 'Amount of delivery fees held for this order';
