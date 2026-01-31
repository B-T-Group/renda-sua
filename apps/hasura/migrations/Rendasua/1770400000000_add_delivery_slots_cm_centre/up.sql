-- Migration: add_delivery_slots_cm_centre
-- Description: Add delivery_time_slots for country CM (Cameroon) and state Centre.

INSERT INTO public.delivery_time_slots (country_code, state, slot_name, slot_type, start_time, end_time, max_orders_per_slot, display_order) VALUES
-- Centre (Cameroon) - Standard delivery slots
('CM', 'Centre', 'Morning', 'standard', '08:00', '12:00', 10, 1),
('CM', 'Centre', 'Afternoon', 'standard', '12:00', '16:00', 10, 2),
('CM', 'Centre', 'Evening', 'standard', '16:00', '20:00', 10, 3),
-- Centre (Cameroon) - Fast delivery slots
('CM', 'Centre', 'Morning Fast', 'fast', '09:00', '12:00', 5, 4),
('CM', 'Centre', 'Afternoon Fast', 'fast', '13:00', '16:00', 5, 5),
('CM', 'Centre', 'Evening Fast', 'fast', '17:00', '20:00', 5, 6)
ON CONFLICT ON CONSTRAINT unique_slot_per_location DO NOTHING;
