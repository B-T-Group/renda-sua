ALTER TABLE public.business_locations
  ADD COLUMN IF NOT EXISTS auto_withdraw_commissions boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.business_locations.auto_withdraw_commissions IS 'When true, commission deposits trigger automatic mobile payout when location phone is set.';

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS auto_withdraw_commissions boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.agents.auto_withdraw_commissions IS 'When true, commission deposits trigger automatic payout to agent user phone. Default false (opt-in).';
