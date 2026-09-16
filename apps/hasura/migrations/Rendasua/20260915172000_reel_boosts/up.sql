CREATE TABLE public.reel_boosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  credits_spent integer NOT NULL DEFAULT 1 CHECK (credits_spent > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.business_reel_credit_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  reel_id uuid NULL REFERENCES public.reels(id) ON DELETE SET NULL,
  credits integer NOT NULL CHECK (credits > 0),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.businesses
  ADD COLUMN reel_credits integer NOT NULL DEFAULT 0 CHECK (reel_credits >= 0);
