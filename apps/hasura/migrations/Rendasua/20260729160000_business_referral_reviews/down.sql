-- Rollback: 20260729160000_business_referral_reviews

DELETE FROM public.message_types WHERE id = 'BUSINESS_REFERRAL_REVIEW_REJECTED';
DELETE FROM public.entity_types WHERE id = 'business_referral_review';

DROP TABLE IF EXISTS public.business_referral_review_item_marks;
DROP TRIGGER IF EXISTS set_public_business_referral_reviews_updated_at ON public.business_referral_reviews;
DROP INDEX IF EXISTS idx_business_referral_reviews_status;
DROP INDEX IF EXISTS idx_business_referral_reviews_agent_id;
DROP TABLE IF EXISTS public.business_referral_reviews;
