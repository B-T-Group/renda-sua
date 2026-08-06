UPDATE public.user_uploads u
SET note = trim(both FROM substring(u.note FROM length('[REJECTED] ') + 1))
FROM public.document_types dt
WHERE u.document_type_id = dt.id
  AND dt.name IN ('id_card', 'passport', 'driver_license')
  AND u.note IS NOT NULL
  AND u.note LIKE '[REJECTED] %';
