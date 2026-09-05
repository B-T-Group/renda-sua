-- Restore standard delivery/pickup slots for CM Centre.
-- Prior trim migration removed Centre standard slots while relying on
-- "Centre Region Province" rows being renamed to Centre; those standard
-- rows are missing in production, so pickup/checkout returns no slots.

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
  ('CM', 'Centre', 'Morning', 'standard', '08:00', '12:00', 10, 1),
  ('CM', 'Centre', 'Afternoon', 'standard', '12:00', '16:00', 10, 2),
  ('CM', 'Centre', 'Evening', 'standard', '16:00', '20:00', 10, 3)
ON CONFLICT ON CONSTRAINT unique_slot_per_location DO NOTHING;
