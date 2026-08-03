-- Restore pre-launch pickup SLA values

UPDATE public.application_configurations
SET number_value = 20,
    description = 'Default minutes after assignment for ASAP pickup deadline'
WHERE config_key = 'pickup_sla_minutes';

UPDATE public.application_configurations
SET number_value = 5,
    description = 'Minutes before pickup_due_at to send agent reminder'
WHERE config_key = 'pickup_reminder_minutes_before';

UPDATE public.application_configurations
SET number_value = 10,
    description = 'Minutes after pickup_due_at before marking overdue'
WHERE config_key = 'pickup_overdue_grace_minutes';

UPDATE public.application_configurations
SET number_value = 20,
    description = 'Minutes after pickup_due_at before eligible for reassignment'
WHERE config_key = 'pickup_reassignment_grace_minutes';
