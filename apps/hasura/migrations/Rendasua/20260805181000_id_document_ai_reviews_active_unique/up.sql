-- At most one active (running or completed) AI review per upload.
-- Failed attempts may repeat; completed/running must be unique so the
-- sweeper can claim work by inserting a running row.
CREATE UNIQUE INDEX idx_id_document_ai_reviews_active_upload
  ON public.id_document_ai_reviews (upload_id)
  WHERE status IN ('running', 'completed');
