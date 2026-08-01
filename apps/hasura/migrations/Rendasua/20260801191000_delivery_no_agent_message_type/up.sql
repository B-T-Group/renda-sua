INSERT INTO public.message_types (id, comment)
VALUES ('DELIVERY_NO_AGENT', 'No delivery agent found for order after dispatch escalation; client fallback options offered')
ON CONFLICT (id) DO NOTHING;
