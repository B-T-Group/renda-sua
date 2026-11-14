-- Idempotency row for the business "condition report accepted" notice.
-- ON CONFLICT on notice_idempotency_key keeps a retry from sending it twice.

INSERT INTO public.message_types (id, comment)
VALUES (
  'RENTAL_PICKUP_ACCEPTED',
  'The renter accepted the pickup condition report.'
)
ON CONFLICT (id) DO NOTHING;
