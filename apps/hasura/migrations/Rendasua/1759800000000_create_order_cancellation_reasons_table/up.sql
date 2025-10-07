-- Create order_cancellation_reasons table
CREATE TABLE public.order_cancellation_reasons (
    id INTEGER PRIMARY KEY,
    value TEXT NOT NULL UNIQUE,
    display TEXT NOT NULL,
    rank INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_order_cancellation_reasons_rank ON public.order_cancellation_reasons(rank);
CREATE INDEX idx_order_cancellation_reasons_value ON public.order_cancellation_reasons(value);

-- Create trigger for updated_at column
CREATE TRIGGER set_public_order_cancellation_reasons_updated_at
    BEFORE UPDATE ON public.order_cancellation_reasons
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Add comment to the trigger
COMMENT ON TRIGGER set_public_order_cancellation_reasons_updated_at ON public.order_cancellation_reasons
    IS 'trigger to set value of column "updated_at" to current timestamp on row update';

-- Add table comment
COMMENT ON TABLE public.order_cancellation_reasons IS 'Predefined list of order cancellation reasons';

-- Insert initial data (id 1 is "other" with highest rank to appear last)
INSERT INTO public.order_cancellation_reasons (id, value, display, rank) VALUES
    (2, 'changed_mind', 'Changed my mind', 1),
    (3, 'found_better_price', 'Found a better price elsewhere', 2),
    (4, 'item_no_longer_needed', 'Item no longer needed', 3),
    (5, 'ordered_by_mistake', 'Ordered by mistake', 4),
    (6, 'delivery_too_slow', 'Delivery taking too long', 5),
    (7, 'delivery_too_expensive', 'Delivery fee too expensive', 6),
    (8, 'payment_issues', 'Having payment issues', 7),
    (9, 'business_not_responding', 'Business not responding', 8),
    (10, 'wrong_item_description', 'Item description was incorrect', 9),
    (11, 'quality_concerns', 'Concerns about item quality', 10),
    (1, 'other', 'Other reason', 99);
