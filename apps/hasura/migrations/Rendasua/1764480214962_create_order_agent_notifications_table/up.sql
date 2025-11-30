-- Create notification_type enum
CREATE TYPE notification_type AS ENUM (
    'order_proximity'
);

-- Create notification_status enum
CREATE TYPE notification_status AS ENUM (
    'pending',
    'complete',
    'failed',
    'skipped'
);

-- Create order_agent_notifications table
CREATE TABLE public.order_agent_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    notification_type notification_type NOT NULL DEFAULT 'order_proximity',
    status notification_status NOT NULL DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    
    -- Unique constraint to prevent duplicate notifications of the same type for the same order
    CONSTRAINT order_agent_notifications_order_type_unique UNIQUE (order_id, notification_type)
);

-- Create indexes for efficient querying
CREATE INDEX idx_order_agent_notifications_status ON public.order_agent_notifications(status);
CREATE INDEX idx_order_agent_notifications_order_id ON public.order_agent_notifications(order_id);
CREATE INDEX idx_order_agent_notifications_notification_type ON public.order_agent_notifications(notification_type);
CREATE INDEX idx_order_agent_notifications_pending ON public.order_agent_notifications(status, notification_type) WHERE status = 'pending';

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_order_agent_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_order_agent_notifications_updated_at
    BEFORE UPDATE ON public.order_agent_notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_order_agent_notifications_updated_at();

-- Add comments for documentation
COMMENT ON TABLE public.order_agent_notifications IS 
'Stores pending agent notifications that need to be sent. Notifications are queued here and processed by a scheduled Lambda function.';

COMMENT ON COLUMN public.order_agent_notifications.notification_type IS 
'Type of notification. Currently only "order_proximity" is supported.';

COMMENT ON COLUMN public.order_agent_notifications.status IS 
'Status of the notification: pending (awaiting processing), complete (successfully sent), failed (error occurred), skipped (order status changed).';

COMMENT ON COLUMN public.order_agent_notifications.error_message IS 
'Error message if notification failed or was skipped.';

COMMENT ON COLUMN public.order_agent_notifications.processed_at IS 
'Timestamp when the notification was processed by the scheduled Lambda.';

