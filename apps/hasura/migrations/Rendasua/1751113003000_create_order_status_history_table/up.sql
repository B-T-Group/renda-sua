-- Create order_status_history table
CREATE TABLE order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status order_status NOT NULL,
    previous_status order_status,
    
    -- Status change details
    changed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    changed_by_type VARCHAR(20) NOT NULL, -- 'client', 'business', 'agent', 'system'
    notes TEXT,
    
    -- Location tracking (optional)
    location_lat DECIMAL(10,8),
    location_lng DECIMAL(11,8),
    location_address TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT order_status_history_changed_by_type_check 
        CHECK (changed_by_type IN ('client', 'business', 'agent', 'system'))
);

-- Create indexes for better performance
CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX idx_order_status_history_status ON order_status_history(status);
CREATE INDEX idx_order_status_history_created_at ON order_status_history(created_at);
CREATE INDEX idx_order_status_history_changed_by_user_id ON order_status_history(changed_by_user_id);

-- Create trigger to automatically log status changes
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

CREATE TRIGGER trigger_log_order_status_change
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION log_order_status_change(); 