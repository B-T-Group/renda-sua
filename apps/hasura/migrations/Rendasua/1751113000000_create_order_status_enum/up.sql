-- Create order_status enum
CREATE TYPE order_status AS ENUM (
    'pending',           -- Order created, waiting for confirmation
    'confirmed',         -- Order confirmed by business
    'preparing',         -- Items being prepared/packed
    'ready_for_pickup',  -- Order ready for agent pickup
    'assigned_to_agent', -- Order assigned to delivery agent
    'picked_up',         -- Agent has picked up the order
    'in_transit',        -- Order is being delivered
    'out_for_delivery',  -- Agent is at customer location
    'delivered',         -- Order successfully delivered
    'cancelled',         -- Order cancelled (by customer or business)
    'failed',            -- Delivery failed (customer not available, etc.)
    'refunded'           -- Order refunded
); 