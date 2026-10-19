-- Notices already written keep their rows (FK RESTRICT); only unused types are dropped.
DELETE FROM public.message_types m
WHERE m.id IN (
  'DEDICATED_ORDER_AUTO_ASSIGNED',
  'DEDICATED_COVERAGE_CONFIRM_REMINDER'
)
  AND NOT EXISTS (SELECT 1 FROM public.user_messages u WHERE u.message_type = m.id);
