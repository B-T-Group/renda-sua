CREATE TABLE public.site_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  subject_type text,
  subject_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  viewer_type text NOT NULL,
  viewer_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_events_subject_pair_chk CHECK (
    (subject_type IS NULL AND subject_id IS NULL)
    OR (subject_type IS NOT NULL AND subject_id IS NOT NULL)
  )
);

CREATE INDEX site_events_event_type_created_at_idx
  ON public.site_events (event_type, created_at DESC);

CREATE INDEX site_events_subject_created_at_idx
  ON public.site_events (subject_type, subject_id, created_at DESC);

CREATE INDEX site_events_created_at_idx
  ON public.site_events (created_at DESC);

COMMENT ON TABLE public.site_events IS 'Append-only client/site analytics events (polymorphic subject).';
