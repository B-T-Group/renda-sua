-- Notices already written keep their rows (FK RESTRICT); only unused types are dropped.
DELETE FROM public.message_types m
WHERE m.id IN (
  'DEDICATED_AGENT_ASSIGNED',
  'DEDICATED_AGENT_PAUSED',
  'DEDICATED_AGENT_RESUMED',
  'DEDICATED_AGENT_REMOVED'
)
  AND NOT EXISTS (SELECT 1 FROM public.user_messages u WHERE u.message_type = m.id);

DELETE FROM public.entity_types e
WHERE e.id = 'dedicated_agent_assignment'
  AND NOT EXISTS (SELECT 1 FROM public.user_messages u WHERE u.entity_type = e.id);
