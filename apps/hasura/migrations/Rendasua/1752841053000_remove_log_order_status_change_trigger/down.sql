-- Restore trigger and function for automatic order status logging

-- Recreate the function
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if status actually changed
    IF OLD.current_status IS DISTINCT FROM NEW.current_status THEN
        INSERT INTO order_status_history (
            order_id,
            status,
            previous_status,
            changed_by_type,
            notes
        ) VALUES (
            NEW.id,
            NEW.current_status,
            OLD.current_status,
            'system',
            'Status automatically updated'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trigger_log_order_status_change
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION log_order_status_change(); 