CREATE UNIQUE INDEX IF NOT EXISTS account_transactions_unique_stripe_payment_deposit
ON public.account_transactions (account_id, reference_id)
WHERE transaction_type = 'deposit'
  AND reference_id IS NOT NULL
  AND memo LIKE 'Stripe payment deposit - %';
