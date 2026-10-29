-- Notices already written keep their rows (FK RESTRICT); only an unused type is dropped.
DELETE FROM public.message_types m
WHERE m.id IN ('DEDICATED_POSTING_CREATED')
  AND NOT EXISTS (SELECT 1 FROM public.user_messages u WHERE u.message_type = m.id);
