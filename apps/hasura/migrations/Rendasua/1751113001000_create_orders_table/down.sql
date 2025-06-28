-- Drop orders table and related objects
DROP TRIGGER IF EXISTS trigger_generate_order_number ON orders;
DROP TRIGGER IF EXISTS trigger_update_orders_updated_at ON orders;
DROP FUNCTION IF EXISTS generate_order_number();
DROP FUNCTION IF EXISTS update_orders_updated_at();
DROP SEQUENCE IF EXISTS orders_order_number_seq;
DROP TABLE IF EXISTS orders; 