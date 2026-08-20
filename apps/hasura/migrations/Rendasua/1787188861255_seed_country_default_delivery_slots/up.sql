-- Country-level default delivery/pickup slots.
-- Used by DeliverySlotsService when a country+state has no active slots.

INSERT INTO public.delivery_time_slots (
  country_code,
  state,
  slot_name,
  slot_type,
  start_time,
  end_time,
  max_orders_per_slot,
  display_order
) VALUES
  -- CM standard
  ('CM', '__DEFAULT__', 'Morning', 'standard', '08:00', '12:00', 10, 1),
  ('CM', '__DEFAULT__', 'Afternoon', 'standard', '12:00', '16:00', 10, 2),
  ('CM', '__DEFAULT__', 'Evening', 'standard', '16:00', '20:00', 10, 3),
  -- CM fast
  ('CM', '__DEFAULT__', 'Morning Fast', 'fast', '09:00', '12:00', 5, 4),
  ('CM', '__DEFAULT__', 'Afternoon Fast', 'fast', '13:00', '16:00', 5, 5),
  ('CM', '__DEFAULT__', 'Evening Fast', 'fast', '17:00', '20:00', 5, 6),
  -- GA standard
  ('GA', '__DEFAULT__', 'Morning', 'standard', '08:00', '12:00', 10, 1),
  ('GA', '__DEFAULT__', 'Afternoon', 'standard', '12:00', '16:00', 10, 2),
  ('GA', '__DEFAULT__', 'Evening', 'standard', '16:00', '20:00', 10, 3),
  -- GA fast
  ('GA', '__DEFAULT__', 'Morning Fast', 'fast', '09:00', '12:00', 5, 4),
  ('GA', '__DEFAULT__', 'Afternoon Fast', 'fast', '13:00', '16:00', 5, 5),
  ('GA', '__DEFAULT__', 'Evening Fast', 'fast', '17:00', '20:00', 5, 6),
  -- CA standard
  ('CA', '__DEFAULT__', 'Morning', 'standard', '08:00', '12:00', 10, 1),
  ('CA', '__DEFAULT__', 'Afternoon', 'standard', '12:00', '16:00', 10, 2),
  ('CA', '__DEFAULT__', 'Evening', 'standard', '16:00', '20:00', 10, 3)
ON CONFLICT ON CONSTRAINT unique_slot_per_location DO NOTHING;
