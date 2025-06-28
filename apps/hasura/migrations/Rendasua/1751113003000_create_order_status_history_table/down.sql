-- Drop order_status_history table and related objects
DROP TRIGGER IF EXISTS trigger_log_order_status_change ON orders;
DROP FUNCTION IF EXISTS log_order_status_change();
DROP TABLE IF EXISTS order_status_history; 