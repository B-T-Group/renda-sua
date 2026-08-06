-- Prefix legacy admin rejection notes on ID documents so parseIdRejectionReason
-- recognizes them. New rejects already use formatIdRejectionNote().
UPDATE public.user_uploads u
SET note = '[REJECTED] ' || trim(u.note)
FROM public.document_types dt
WHERE u.document_type_id = dt.id
  AND dt.name IN ('id_card', 'passport', 'driver_license')
  AND u.is_approved = false
  AND u.note IS NOT NULL
  AND trim(u.note) <> ''
  AND trim(u.note) NOT LIKE '[REJECTED] %';
