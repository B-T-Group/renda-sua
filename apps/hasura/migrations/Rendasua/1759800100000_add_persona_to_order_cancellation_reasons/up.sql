-- Add persona column as an array to support multiple personas per reason
ALTER TABLE public.order_cancellation_reasons 
ADD COLUMN persona TEXT[] NOT NULL DEFAULT ARRAY['client', 'business'];

-- Create index for better performance when filtering by persona
CREATE INDEX idx_order_cancellation_reasons_persona ON public.order_cancellation_reasons USING GIN(persona);

-- Add comment
COMMENT ON COLUMN public.order_cancellation_reasons.persona IS 'Personas that can use this cancellation reason (client, business, agent)';

-- Update existing client-specific reasons
UPDATE public.order_cancellation_reasons 
SET persona = ARRAY['client']
WHERE id IN (2, 3, 4, 5, 6, 7, 8, 9, 10, 11);

-- Update "other" to be available for both client and business
UPDATE public.order_cancellation_reasons 
SET persona = ARRAY['client', 'business']
WHERE id = 1;

-- Add business-specific cancellation reasons
INSERT INTO public.order_cancellation_reasons (id, value, display, rank, persona) VALUES
    (12, 'out_of_stock', 'Item is out of stock', 11, ARRAY['business']),
    (13, 'cannot_fulfill_order', 'Cannot fulfill order', 12, ARRAY['business']),
    (14, 'pricing_error', 'Pricing error in listing', 13, ARRAY['business']),
    (15, 'business_closed', 'Business temporarily closed', 14, ARRAY['business']),
    (16, 'item_damaged', 'Item damaged or defective', 15, ARRAY['business']),
    (17, 'customer_unreachable', 'Cannot reach customer', 16, ARRAY['business']),
    (18, 'delivery_area_unavailable', 'Delivery area not available', 17, ARRAY['business']);
