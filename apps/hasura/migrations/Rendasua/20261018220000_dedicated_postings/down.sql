DROP FUNCTION IF EXISTS public.dedicated_accept_application(uuid, uuid);

-- Notices already written keep their rows (FK RESTRICT); only unused types are dropped.
DELETE FROM public.message_types m
WHERE m.id IN (
  'DEDICATED_POSTING_NEW_APPLICATION',
  'DEDICATED_POSTING_ACCEPTED',
  'DEDICATED_POSTING_FILLED',
  'DEDICATED_POSTING_CLOSED',
  'DEDICATED_POSTING_TERMS_UPDATED'
)
  AND NOT EXISTS (SELECT 1 FROM public.user_messages u WHERE u.message_type = m.id);

DELETE FROM public.entity_types e
WHERE e.id = 'dedicated_agent_posting'
  AND NOT EXISTS (SELECT 1 FROM public.user_messages u WHERE u.entity_type = e.id);
