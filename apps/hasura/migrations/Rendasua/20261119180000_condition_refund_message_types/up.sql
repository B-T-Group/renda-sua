-- Renter and business decline notices insert these message_types.
-- ON CONFLICT keeps a retry, and a database that already has the row, idempotent.

INSERT INTO public.message_types (id, comment)
VALUES
  ('CONDITION_REFUND', 'The renter is told when a declined-condition refund is in the wallet or has been sent.'),
  ('CONDITION_DECLINED', 'The business is told when the renter declines the pickup condition.')
ON CONFLICT (id) DO NOTHING;
