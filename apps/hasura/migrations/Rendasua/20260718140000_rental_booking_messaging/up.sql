INSERT INTO public.entity_types (id, comment)
VALUES ('rental_booking', 'Rental booking messages between client and business')
ON CONFLICT (id) DO NOTHING;
