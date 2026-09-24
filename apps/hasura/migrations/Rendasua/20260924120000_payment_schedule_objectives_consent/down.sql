DELETE FROM public.message_types
WHERE id IN ('PAYMENT_SCHEDULE_OFFER', 'PAYMENT_SCHEDULE_DECISION');

DROP INDEX IF EXISTS public.idx_ps_assignments_decision;
DROP INDEX IF EXISTS public.idx_ps_assignment_decisions_assignment;
DROP TABLE IF EXISTS public.payment_schedule_assignment_decisions;

ALTER TABLE public.payment_schedule_assignments
  DROP COLUMN IF EXISTS reject_note,
  DROP COLUMN IF EXISTS reject_reason,
  DROP COLUMN IF EXISTS accepted_at,
  DROP COLUMN IF EXISTS decision,
  DROP COLUMN IF EXISTS target_rental_amount,
  DROP COLUMN IF EXISTS target_item_sales_amount,
  DROP COLUMN IF EXISTS target_merchant_recruitments,
  DROP COLUMN IF EXISTS target_client_signups,
  DROP COLUMN IF EXISTS target_agent_recruitments;

ALTER TABLE public.payment_schedules
  DROP COLUMN IF EXISTS target_rental_amount,
  DROP COLUMN IF EXISTS target_item_sales_amount,
  DROP COLUMN IF EXISTS target_merchant_recruitments,
  DROP COLUMN IF EXISTS target_client_signups,
  DROP COLUMN IF EXISTS target_agent_recruitments;

DROP TYPE IF EXISTS public.payment_schedule_reject_reason;
DROP TYPE IF EXISTS public.payment_schedule_decision_event;
DROP TYPE IF EXISTS public.payment_schedule_assignment_decision;

-- Enum values pending_acceptance / rejected on payment_program_status cannot be removed safely.
