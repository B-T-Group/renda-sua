-- User-generated content reports and business content blocks

CREATE TYPE public.content_report_subject_type AS ENUM (
  'reel',
  'reel_comment',
  'sale_item',
  'rental_listing'
);

CREATE TYPE public.content_report_reason AS ENUM (
  'spam',
  'misleading',
  'inappropriate',
  'harassment',
  'intellectual_property',
  'off_platform_contact',
  'other'
);

CREATE TYPE public.content_report_status AS ENUM (
  'pending',
  'reviewing',
  'resolved',
  'dismissed'
);

CREATE TABLE public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type public.content_report_subject_type NOT NULL,
  subject_id uuid NOT NULL,
  reporter_user_id uuid NOT NULL REFERENCES public.users(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  reason public.content_report_reason NOT NULL,
  details text NULL,
  status public.content_report_status NOT NULL DEFAULT 'pending',
  resolved_by_user_id uuid NULL REFERENCES public.users(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  resolution text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_reports_reporter_subject_unique
    UNIQUE (reporter_user_id, subject_type, subject_id)
);

CREATE INDEX content_reports_status_created_idx
  ON public.content_reports (status, created_at DESC);

CREATE INDEX content_reports_subject_idx
  ON public.content_reports (subject_type, subject_id);

CREATE TABLE public.business_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_user_id uuid NOT NULL REFERENCES public.users(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_blocks_blocker_business_unique
    UNIQUE (blocker_user_id, business_id)
);

CREATE INDEX business_blocks_blocker_idx
  ON public.business_blocks (blocker_user_id);

COMMENT ON TABLE public.content_reports IS
  'User reports on UGC (reels, comments, listings). Content-scoped; does not affect orders.';
COMMENT ON TABLE public.business_blocks IS
  'User blocks merchant content (reels, etc.). Does not block ordering.';
