-- Quoted totals filled by the up migration stay. They are the contract amount
-- a pending request was missing, and reversing them would blank the card again.

DELETE FROM public.application_configurations
 WHERE config_key = 'rentals_request_card_enabled' AND country_code IS NULL;
