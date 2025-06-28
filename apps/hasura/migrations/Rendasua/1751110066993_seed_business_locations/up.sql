-- Insert addresses for business locations and store their IDs
WITH inserted_addresses AS (
    INSERT INTO public.addresses (
        id,
        entity_type,
        entity_id,
        address_line_1,
        address_line_2,
        city,
        state,
        postal_code,
        country,
        is_primary,
        address_type,
        latitude,
        longitude
    ) VALUES 
    -- Main Store Address
    (
        gen_random_uuid(),
        'business',
        'eb6b7525-ab79-416e-bac8-254b1e8a6d6c',
        '123 Main Street',
        'Suite 100',
        'Douala',
        'Littoral',
        '23701',
        'Cameroon',
        true,
        'work',
        4.0511,
        9.7679
    ),
    -- Warehouse Address
    (
        gen_random_uuid(),
        'business',
        'eb6b7525-ab79-416e-bac8-254b1e8a6d6c',
        '456 Industrial Boulevard',
        'Building A',
        'Douala',
        'Littoral',
        '23702',
        'Cameroon',
        false,
        'work',
        4.0611,
        9.7579
    ),
    -- Pickup Point Address
    (
        gen_random_uuid(),
        'business',
        'eb6b7525-ab79-416e-bac8-254b1e8a6d6c',
        '789 Shopping Center',
        'Ground Floor',
        'Yaoundé',
        'Centre',
        '23703',
        'Cameroon',
        false,
        'work',
        3.8480,
        11.5021
    )
    RETURNING id, address_line_1
)
-- Insert business locations using the address IDs
INSERT INTO public.business_locations (
    business_id,
    name,
    address_id,
    phone,
    email,
    operating_hours,
    is_active,
    is_primary,
    location_type
)
SELECT 
    'eb6b7525-ab79-416e-bac8-254b1e8a6d6c',
    CASE 
        WHEN addr.address_line_1 = '123 Main Street' THEN 'Main Store - Douala'
        WHEN addr.address_line_1 = '456 Industrial Boulevard' THEN 'Warehouse - Douala'
        WHEN addr.address_line_1 = '789 Shopping Center' THEN 'Pickup Point - Yaoundé'
    END,
    addr.id,
    CASE 
        WHEN addr.address_line_1 = '123 Main Street' THEN '+237 233 123 456'
        WHEN addr.address_line_1 = '456 Industrial Boulevard' THEN '+237 233 123 457'
        WHEN addr.address_line_1 = '789 Shopping Center' THEN '+237 222 123 458'
    END,
    CASE 
        WHEN addr.address_line_1 = '123 Main Street' THEN 'mainstore@business.com'
        WHEN addr.address_line_1 = '456 Industrial Boulevard' THEN 'warehouse@business.com'
        WHEN addr.address_line_1 = '789 Shopping Center' THEN 'pickup@business.com'
    END,
    CASE 
        WHEN addr.address_line_1 = '123 Main Street' THEN '{"monday": {"open": "08:00", "close": "18:00"}, "tuesday": {"open": "08:00", "close": "18:00"}, "wednesday": {"open": "08:00", "close": "18:00"}, "thursday": {"open": "08:00", "close": "18:00"}, "friday": {"open": "08:00", "close": "20:00"}, "saturday": {"open": "09:00", "close": "17:00"}, "sunday": {"open": "10:00", "close": "16:00"}}'::jsonb
        WHEN addr.address_line_1 = '456 Industrial Boulevard' THEN '{"monday": {"open": "06:00", "close": "22:00"}, "tuesday": {"open": "06:00", "close": "22:00"}, "wednesday": {"open": "06:00", "close": "22:00"}, "thursday": {"open": "06:00", "close": "22:00"}, "friday": {"open": "06:00", "close": "22:00"}, "saturday": {"open": "07:00", "close": "20:00"}, "sunday": {"open": "08:00", "close": "18:00"}}'::jsonb
        WHEN addr.address_line_1 = '789 Shopping Center' THEN '{"monday": {"open": "09:00", "close": "17:00"}, "tuesday": {"open": "09:00", "close": "17:00"}, "wednesday": {"open": "09:00", "close": "17:00"}, "thursday": {"open": "09:00", "close": "17:00"}, "friday": {"open": "09:00", "close": "18:00"}, "saturday": {"open": "10:00", "close": "16:00"}, "sunday": {"open": "closed", "close": "closed"}}'::jsonb
    END,
    true,
    CASE 
        WHEN addr.address_line_1 = '123 Main Street' THEN true
        ELSE false
    END,
    CASE 
        WHEN addr.address_line_1 = '123 Main Street' THEN 'store'
        WHEN addr.address_line_1 = '456 Industrial Boulevard' THEN 'warehouse'
        WHEN addr.address_line_1 = '789 Shopping Center' THEN 'pickup_point'
    END
FROM inserted_addresses addr;
