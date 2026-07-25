INSERT INTO public.message_types (id, comment)
VALUES ('STOCK_AVAILABILITY', 'Client stock availability check for business inventory')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.entity_types (id, comment)
VALUES ('business_inventory', 'Business inventory stock availability messages')
ON CONFLICT (id) DO NOTHING;
