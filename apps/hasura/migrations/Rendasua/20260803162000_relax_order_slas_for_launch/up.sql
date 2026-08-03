-- Relax order pickup SLAs for first release (more breathing room for agents)

UPDATE public.application_configurations
SET number_value = 40,
    description = 'Default minutes after assignment for ASAP pickup deadline (relaxed for launch)'
WHERE config_key = 'pickup_sla_minutes';

UPDATE public.application_configurations
SET number_value = 10,
    description = 'Minutes before pickup_due_at to send agent reminder'
WHERE config_key = 'pickup_reminder_minutes_before';

UPDATE public.application_configurations
SET number_value = 15,
    description = 'Minutes after pickup_due_at before marking overdue (relaxed for launch)'
WHERE config_key = 'pickup_overdue_grace_minutes';

UPDATE public.application_configurations
SET number_value = 40,
    description = 'Minutes after pickup_due_at before eligible for reassignment (relaxed for launch)'
WHERE config_key = 'pickup_reassignment_grace_minutes';
