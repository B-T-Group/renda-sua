-- Enable Orange Momo for CM and Moov for GA so landing page can display country-specific payment methods
UPDATE public.supported_payment_systems
SET active = true, updated_at = NOW()
WHERE (name = 'orange' AND country = 'CM') OR (name = 'moov' AND country = 'GA');
