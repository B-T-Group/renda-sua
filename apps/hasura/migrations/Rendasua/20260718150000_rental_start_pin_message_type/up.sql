INSERT INTO public.message_types (id, comment)
VALUES ('RENTAL_START_PIN', 'Client-shared rental start PIN for business')
ON CONFLICT (id) DO NOTHING;
