-- Drop order_items table and related objects
DROP TRIGGER IF EXISTS trigger_calculate_order_item_total ON order_items;
DROP TRIGGER IF EXISTS trigger_update_order_items_updated_at ON order_items;
DROP FUNCTION IF EXISTS calculate_order_item_total();
DROP FUNCTION IF EXISTS update_order_items_updated_at();
DROP TABLE IF EXISTS order_items; 