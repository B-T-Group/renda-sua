ALTER TABLE public.businesses
    DROP COLUMN IF EXISTS merchant_agreement_accepted_at,
    DROP COLUMN IF EXISTS merchant_agreement_version;

DROP TABLE IF EXISTS public.business_merchant_agreement_acceptances;
