ALTER TABLE public.orders
  DROP COLUMN IF EXISTS pickup_reminder_last_sent_at;
