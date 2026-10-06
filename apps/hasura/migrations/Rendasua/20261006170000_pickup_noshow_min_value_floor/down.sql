-- Revert pickup_noshow_cancel_hours min_value floor from 1 back to 0.
-- WARNING: rolling back to min_value=0 allows invalid config rows again.

UPDATE public.application_configurations
SET min_value = 0
WHERE config_key = 'pickup_noshow_cancel_hours';
