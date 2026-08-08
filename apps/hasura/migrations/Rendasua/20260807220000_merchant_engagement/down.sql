DROP TABLE IF EXISTS public.merchant_engagement_sends;

ALTER TABLE public.businesses
  DROP COLUMN IF EXISTS tips_reminders_enabled;
