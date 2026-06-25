-- Revert: create_stripe_tables
DROP TABLE IF EXISTS public.stripe_events;
DROP TABLE IF EXISTS public.stripe_payment_transactions;
DROP TABLE IF EXISTS public.stripe_connect_accounts;
