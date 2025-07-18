-- Remove trigger and function for automatic order status logging
-- This is being removed because status changes are now handled manually in the application

-- Drop the trigger first
DROP TRIGGER IF EXISTS trigger_log_order_status_change ON orders;

-- Drop the function
DROP FUNCTION IF EXISTS log_order_status_change(); 