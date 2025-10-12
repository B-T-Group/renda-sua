-- Fix Gabon states data migration
-- 1. Delete incorrect "Littoral" state (doesn't exist in Gabon)
-- 2. Update "Estuaire" state with fast delivery configuration

-- Delete the incorrect "Littoral" state from Gabon
DELETE FROM public.supported_country_states 
WHERE country_code = 'GA' AND state_code = 'Littoral';

-- Update "Estuaire" state with fast delivery configuration
UPDATE public.supported_country_states 
SET fast_delivery = '{
    "fee": 2000,
    "enabled": true,
    "maxHours": 4,
    "minHours": 2,
    "operatingHours": {
        "friday": {
            "end": "20:00",
            "start": "08:00",
            "enabled": true
        },
        "monday": {
            "end": "20:00",
            "start": "08:00",
            "enabled": true
        },
        "sunday": {
            "end": "16:00",
            "start": "10:00",
            "enabled": false
        },
        "tuesday": {
            "end": "20:00",
            "start": "08:00",
            "enabled": true
        },
        "saturday": {
            "end": "18:00",
            "start": "08:00",
            "enabled": true
        },
        "thursday": {
            "end": "20:00",
            "start": "08:00",
            "enabled": true
        },
        "wednesday": {
            "end": "20:00",
            "start": "08:00",
            "enabled": true
        }
    }
}'::jsonb
WHERE country_code = 'GA' AND state_code = 'Estuaire';

-- Add comments for documentation
COMMENT ON TABLE public.supported_country_states IS 'Updated Gabon states: removed Littoral (invalid), configured Estuaire fast delivery';
