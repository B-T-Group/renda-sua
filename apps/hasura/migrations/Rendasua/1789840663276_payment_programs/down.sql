DELETE FROM public.role_permissions
WHERE permission_id = (
  SELECT id FROM public.permissions WHERE key = 'platform.financial.payment_programs'
);
DELETE FROM public.permissions WHERE key = 'platform.financial.payment_programs';

DELETE FROM public.message_types WHERE id IN (
  'PAYMENT_SCHEDULE', 'CASH_ADVANCE_FACILITY', 'CASH_ADVANCE_DRAW', 'PURCHASE_CREDIT'
);

DROP TABLE IF EXISTS public.purchase_credit_redemptions;
DROP TABLE IF EXISTS public.purchase_credit_grants;
DROP TABLE IF EXISTS public.partner_businesses;
DROP TABLE IF EXISTS public.cash_advance_draws;
DROP TABLE IF EXISTS public.cash_advance_facilities;
DROP TABLE IF EXISTS public.cash_advance_programs;
DROP TABLE IF EXISTS public.payment_schedule_runs;
DROP TABLE IF EXISTS public.payment_schedule_assignments;
DROP TABLE IF EXISTS public.payment_schedules;

DROP TYPE IF EXISTS public.purchase_credit_source;
DROP TYPE IF EXISTS public.purchase_credit_applicability;
DROP TYPE IF EXISTS public.payment_schedule_run_status;
DROP TYPE IF EXISTS public.payment_program_status;
DROP TYPE IF EXISTS public.payment_schedule_frequency;

ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_cash_advance_balance_non_positive;
ALTER TABLE public.accounts DROP COLUMN IF EXISTS cash_advance_balance;
