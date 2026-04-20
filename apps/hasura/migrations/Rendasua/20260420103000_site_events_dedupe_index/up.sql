CREATE INDEX IF NOT EXISTS site_events_dedupe_lookup_idx
  ON public.site_events (
    viewer_type,
    viewer_id,
    event_type,
    subject_type,
    subject_id,
    created_at DESC
  );

