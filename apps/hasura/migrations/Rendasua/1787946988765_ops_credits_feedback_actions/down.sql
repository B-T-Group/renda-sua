ALTER TABLE public.orders DROP COLUMN IF EXISTS ops_classification;

DROP TYPE IF EXISTS public.order_ops_classification;

-- Postgres cannot remove enum values safely; leave credit_contact_channel.in_person.
