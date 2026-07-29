-- Business referral payout quality reviews (admin approve/reject before weekly credit)

CREATE TABLE public.business_referral_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT uq_business_referral_reviews_business_id UNIQUE (business_id),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text NULL,
  good_item_count integer NOT NULL DEFAULT 0,
  bad_item_count integer NOT NULL DEFAULT 0,
  reviewed_by_user_id uuid NULL REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  reviewed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT business_referral_reviews_reject_reason_chk CHECK (
    status <> 'rejected' OR (rejection_reason IS NOT NULL AND length(trim(rejection_reason)) > 0)
  )
);

COMMENT ON TABLE public.business_referral_reviews IS
  'Admin quality review for business referral payouts. Approved referrals may be credited by the weekly job.';
COMMENT ON COLUMN public.business_referral_reviews.status IS
  'pending = draft/in progress; approved = eligible for weekly payout; rejected = not payable until re-reviewed.';
COMMENT ON COLUMN public.business_referral_reviews.rejection_reason IS
  'Required when status is rejected; shown to the referring agent.';

CREATE INDEX idx_business_referral_reviews_agent_id
  ON public.business_referral_reviews (agent_id);
CREATE INDEX idx_business_referral_reviews_status
  ON public.business_referral_reviews (status);

CREATE TRIGGER set_public_business_referral_reviews_updated_at
  BEFORE UPDATE ON public.business_referral_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TABLE public.business_referral_review_item_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.business_referral_reviews(id) ON UPDATE CASCADE ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON UPDATE CASCADE ON DELETE CASCADE,
  quality text NOT NULL CHECK (quality IN ('good', 'bad')),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_business_referral_review_item_marks UNIQUE (review_id, item_id)
);

COMMENT ON TABLE public.business_referral_review_item_marks IS
  'Per-item good/bad quality marks within a business referral payout review (advisory; does not change catalog moderation).';

CREATE INDEX idx_business_referral_review_item_marks_item_id
  ON public.business_referral_review_item_marks (item_id);

INSERT INTO public.entity_types (id, comment)
VALUES (
  'business_referral_review',
  'Business referral payout review messages (approve/reject for agent)'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.message_types (id, comment)
VALUES (
  'BUSINESS_REFERRAL_REVIEW_REJECTED',
  'Business referral payout rejected after quality review'
)
ON CONFLICT (id) DO NOTHING;
