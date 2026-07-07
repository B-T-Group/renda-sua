ALTER TABLE public.businesses
  ADD COLUMN referred_by_agent_id uuid NULL
    REFERENCES public.agents(id) ON DELETE SET NULL,
  ADD COLUMN referral_code_used text NULL;

CREATE INDEX businesses_referred_by_agent_id_idx
  ON public.businesses (referred_by_agent_id)
  WHERE referred_by_agent_id IS NOT NULL;

COMMENT ON COLUMN public.businesses.referred_by_agent_id IS
  'Agent who referred this business at signup (immutable after creation)';
COMMENT ON COLUMN public.businesses.referral_code_used IS
  'Agent referral code entered at business signup';
