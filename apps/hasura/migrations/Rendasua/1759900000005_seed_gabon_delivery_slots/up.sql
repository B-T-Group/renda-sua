-- Seed initial delivery time slots for Gabon
INSERT INTO public.delivery_time_slots (country_code, state_code, slot_name, slot_type, start_time, end_time, max_orders_per_slot, display_order) VALUES
-- Estuaire Province (Libreville) - Standard delivery slots
('GA', 'Estuaire', 'Morning', 'standard', '08:00', '12:00', 15, 1),
('GA', 'Estuaire', 'Afternoon', 'standard', '12:00', '16:00', 15, 2),
('GA', 'Estuaire', 'Evening', 'standard', '16:00', '20:00', 15, 3),

-- Estuaire Province (Libreville) - Fast delivery slots (same-day only)
('GA', 'Estuaire', 'Morning Fast', 'fast', '09:00', '12:00', 5, 4),
('GA', 'Estuaire', 'Afternoon Fast', 'fast', '13:00', '16:00', 5, 5),
('GA', 'Estuaire', 'Evening Fast', 'fast', '17:00', '20:00', 5, 6),

-- Haut-Ogooué Province - Standard delivery slots
('GA', 'Haut-Ogooué', 'Morning', 'standard', '08:00', '12:00', 10, 1),
('GA', 'Haut-Ogooué', 'Afternoon', 'standard', '12:00', '16:00', 10, 2),
('GA', 'Haut-Ogooué', 'Evening', 'standard', '16:00', '20:00', 10, 3),

-- Moyen-Ogooué Province - Standard delivery slots
('GA', 'Moyen-Ogooué', 'Morning', 'standard', '08:00', '12:00', 8, 1),
('GA', 'Moyen-Ogooué', 'Afternoon', 'standard', '12:00', '16:00', 8, 2),
('GA', 'Moyen-Ogooué', 'Evening', 'standard', '16:00', '20:00', 8, 3),

-- Ngounié Province - Standard delivery slots
('GA', 'Ngounié', 'Morning', 'standard', '08:00', '12:00', 8, 1),
('GA', 'Ngounié', 'Afternoon', 'standard', '12:00', '16:00', 8, 2),
('GA', 'Ngounié', 'Evening', 'standard', '16:00', '20:00', 8, 3),

-- Nyanga Province - Standard delivery slots
('GA', 'Nyanga', 'Morning', 'standard', '08:00', '12:00', 6, 1),
('GA', 'Nyanga', 'Afternoon', 'standard', '12:00', '16:00', 6, 2),
('GA', 'Nyanga', 'Evening', 'standard', '16:00', '20:00', 6, 3),

-- Ogooué-Ivindo Province - Standard delivery slots
('GA', 'Ogooué-Ivindo', 'Morning', 'standard', '08:00', '12:00', 6, 1),
('GA', 'Ogooué-Ivindo', 'Afternoon', 'standard', '12:00', '16:00', 6, 2),
('GA', 'Ogooué-Ivindo', 'Evening', 'standard', '16:00', '20:00', 6, 3),

-- Ogooué-Lolo Province - Standard delivery slots
('GA', 'Ogooué-Lolo', 'Morning', 'standard', '08:00', '12:00', 6, 1),
('GA', 'Ogooué-Lolo', 'Afternoon', 'standard', '12:00', '16:00', 6, 2),
('GA', 'Ogooué-Lolo', 'Evening', 'standard', '16:00', '20:00', 6, 3),

-- Ogooué-Maritime Province - Standard delivery slots
('GA', 'Ogooué-Maritime', 'Morning', 'standard', '08:00', '12:00', 8, 1),
('GA', 'Ogooué-Maritime', 'Afternoon', 'standard', '12:00', '16:00', 8, 2),
('GA', 'Ogooué-Maritime', 'Evening', 'standard', '16:00', '20:00', 8, 3),

-- Woleu-Ntem Province - Standard delivery slots
('GA', 'Woleu-Ntem', 'Morning', 'standard', '08:00', '12:00', 8, 1),
('GA', 'Woleu-Ntem', 'Afternoon', 'standard', '12:00', '16:00', 8, 2),
('GA', 'Woleu-Ntem', 'Evening', 'standard', '16:00', '20:00', 8, 3);
