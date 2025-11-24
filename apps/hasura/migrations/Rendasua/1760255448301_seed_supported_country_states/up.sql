-- Insert initial supported locations
INSERT INTO public.supported_country_states (
    country_code, country_name, state_code, state_name, currency_code,
    service_status, delivery_enabled, fast_delivery,
    supported_payment_methods, launch_date
) VALUES 
    -- Gabon locations
    ('GA', 'Gabon', 'Littoral', 'Littoral Province', 'XAF', 
     'active', true, 
     '{"enabled": true, "fee": 2000, "minHours": 2, "maxHours": 4, "operatingHours": {"monday": {"start": "08:00", "end": "20:00", "enabled": true}, "tuesday": {"start": "08:00", "end": "20:00", "enabled": true}, "wednesday": {"start": "08:00", "end": "20:00", "enabled": true}, "thursday": {"start": "08:00", "end": "20:00", "enabled": true}, "friday": {"start": "08:00", "end": "20:00", "enabled": true}, "saturday": {"start": "08:00", "end": "18:00", "enabled": true}, "sunday": {"start": "10:00", "end": "16:00", "enabled": false}}}'::jsonb,
     ARRAY['airtel', 'moov'], '2024-01-01'),
    
    ('GA', 'Gabon', 'Estuaire', 'Estuaire Province', 'XAF',
     'active', true,
     '{"enabled": false, "fee": 0, "minHours": 0, "maxHours": 0, "operatingHours": {}}'::jsonb,
     ARRAY['airtel', 'moov'], '2024-01-01'),
    
    ('GA', 'Gabon', 'Haut-Ogooué', 'Haut-Ogooué Province', 'XAF',
     'active', true,
     '{"enabled": false, "fee": 0, "minHours": 0, "maxHours": 0, "operatingHours": {}}'::jsonb,
     ARRAY['airtel', 'moov'], '2024-01-01'),
    
    ('GA', 'Gabon', 'Moyen-Ogooué', 'Moyen-Ogooué Province', 'XAF',
     'active', true,
     '{"enabled": false, "fee": 0, "minHours": 0, "maxHours": 0, "operatingHours": {}}'::jsonb,
     ARRAY['airtel', 'moov'], '2024-01-01'),
    
    ('GA', 'Gabon', 'Ngounié', 'Ngounié Province', 'XAF',
     'active', true,
     '{"enabled": false, "fee": 0, "minHours": 0, "maxHours": 0, "operatingHours": {}}'::jsonb,
     ARRAY['airtel', 'moov'], '2024-01-01'),
    
    ('GA', 'Gabon', 'Nyanga', 'Nyanga Province', 'XAF',
     'active', true,
     '{"enabled": false, "fee": 0, "minHours": 0, "maxHours": 0, "operatingHours": {}}'::jsonb,
     ARRAY['airtel', 'moov'], '2024-01-01'),
    
    ('GA', 'Gabon', 'Ogooué-Ivindo', 'Ogooué-Ivindo Province', 'XAF',
     'active', true,
     '{"enabled": false, "fee": 0, "minHours": 0, "maxHours": 0, "operatingHours": {}}'::jsonb,
     ARRAY['airtel', 'moov'], '2024-01-01'),
    
    ('GA', 'Gabon', 'Ogooué-Lolo', 'Ogooué-Lolo Province', 'XAF',
     'active', true,
     '{"enabled": false, "fee": 0, "minHours": 0, "maxHours": 0, "operatingHours": {}}'::jsonb,
     ARRAY['airtel', 'moov'], '2024-01-01'),
    
    ('GA', 'Gabon', 'Ogooué-Maritime', 'Ogooué-Maritime Province', 'XAF',
     'active', true,
     '{"enabled": false, "fee": 0, "minHours": 0, "maxHours": 0, "operatingHours": {}}'::jsonb,
     ARRAY['airtel', 'moov'], '2024-01-01'),
    
    ('GA', 'Gabon', 'Woleu-Ntem', 'Woleu-Ntem Province', 'XAF',
     'active', true,
     '{"enabled": false, "fee": 0, "minHours": 0, "maxHours": 0, "operatingHours": {}}'::jsonb,
     ARRAY['airtel', 'moov'], '2024-01-01'),
    
    -- Cameroon locations (coming soon)
    ('CM', 'Cameroon', 'Littoral', 'Littoral Region', 'XAF',
     'coming_soon', false,
     '{"enabled": false, "fee": 0, "minHours": 0, "maxHours": 0, "operatingHours": {}}'::jsonb,
     ARRAY['mtn', 'orange'], '2024-06-01'),
    
    ('CM', 'Cameroon', 'Centre', 'Centre Region', 'XAF',
     'coming_soon', false,
     '{"enabled": false, "fee": 0, "minHours": 0, "maxHours": 0, "operatingHours": {}}'::jsonb,
     ARRAY['mtn', 'orange'], '2024-06-01'),
    
    ('CM', 'Cameroon', 'Ouest', 'Ouest Region', 'XAF',
     'coming_soon', false,
     '{"enabled": false, "fee": 0, "minHours": 0, "maxHours": 0, "operatingHours": {}}'::jsonb,
     ARRAY['mtn', 'orange'], '2024-06-01'),
    
    ('CM', 'Cameroon', 'Nord-Ouest', 'Nord-Ouest Region', 'XAF',
     'coming_soon', false,
     '{"enabled": false, "fee": 0, "minHours": 0, "maxHours": 0, "operatingHours": {}}'::jsonb,
     ARRAY['mtn', 'orange'], '2024-06-01'),
    
    ('CM', 'Cameroon', 'Sud-Ouest', 'Sud-Ouest Region', 'XAF',
     'coming_soon', false,
     '{"enabled": false, "fee": 0, "minHours": 0, "maxHours": 0, "operatingHours": {}}'::jsonb,
     ARRAY['mtn', 'orange'], '2024-06-01');


