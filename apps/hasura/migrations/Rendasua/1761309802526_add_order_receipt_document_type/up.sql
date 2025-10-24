-- Add order_receipt document type with specific id
INSERT INTO public.document_types (id, name, description) VALUES
    (23, 'order_receipt', 'Order receipt generated after order completion')
ON CONFLICT (id) DO NOTHING;
