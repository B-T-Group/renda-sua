CREATE TYPE public.reel_moderation_status AS ENUM (
  'draft', 'pending', 'ai_reviewing', 'proposal_pending', 'approved', 'rejected'
);
CREATE TYPE public.reel_processing_status AS ENUM (
  'awaiting_upload', 'uploaded', 'queued', 'processing', 'ready', 'failed'
);
CREATE TYPE public.reel_generation_source AS ENUM ('merchant', 'ai');

ALTER TABLE public.businesses
  ADD COLUMN reels_enabled_allowlist boolean NOT NULL DEFAULT false;

CREATE TABLE public.reels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  subject_type text NOT NULL CHECK (subject_type IN ('item', 'rental', 'business')),
  subject_id uuid NOT NULL,
  caption text NULL,
  moderation_status public.reel_moderation_status NOT NULL DEFAULT 'draft',
  processing_status public.reel_processing_status NOT NULL DEFAULT 'awaiting_upload',
  generation_source public.reel_generation_source NOT NULL DEFAULT 'merchant',
  market_country char(2) NOT NULL,
  currency char(3) NULL,
  price_at_approval numeric(14,2) NULL,
  like_count integer NOT NULL DEFAULT 0 CHECK (like_count >= 0),
  view_count bigint NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  share_count integer NOT NULL DEFAULT 0 CHECK (share_count >= 0),
  source_s3_key text NULL,
  processed_s3_key text NULL,
  thumbnail_s3_key text NULL,
  video_url text NULL,
  thumbnail_url text NULL,
  duration_ms integer NULL CHECK (duration_ms IS NULL OR duration_ms > 0),
  width integer NULL,
  height integer NULL,
  processing_error text NULL,
  moderation_reason text NULL,
  moderated_by_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  moderated_at timestamptz NULL,
  submitted_at timestamptz NULL,
  published_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reels_business_created_idx ON public.reels (business_id, created_at DESC);
CREATE INDEX reels_moderation_created_idx ON public.reels (moderation_status, created_at);
CREATE INDEX reels_feed_idx ON public.reels (market_country, published_at DESC)
  WHERE moderation_status = 'approved' AND processing_status = 'ready';

CREATE TABLE public.reel_likes (
  reel_id uuid NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (reel_id, user_id)
);

CREATE TABLE public.reel_view_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  session_id text NULL,
  watch_time_ms integer NOT NULL DEFAULT 0 CHECK (watch_time_ms >= 0),
  completed boolean NOT NULL DEFAULT false,
  last_served_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reel_view_events_reel_created_idx
  ON public.reel_view_events (reel_id, created_at DESC);
CREATE INDEX reel_view_events_user_served_idx
  ON public.reel_view_events (user_id, last_served_at DESC);
