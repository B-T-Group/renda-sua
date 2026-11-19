/**
 * One statement. Deletes this decline and restores the booking only when no
 * decline:refund debit and no payout marker exist, and no other decline row remains.
 */
export const REVERT_UNPAID_DECLINE = `
WITH blocked AS (
  SELECT 1 FROM account_transactions WHERE idempotency_key = $1
  UNION ALL
  SELECT 1 FROM rental_bookings
  WHERE id = $2::uuid
    AND (
      refund_provider_ref IS NOT NULL
      OR refund_sent_at IS NOT NULL
      OR COALESCE(refund_status, 'none') <> 'none'
    )
),
removed AS (
  DELETE FROM rental_condition_declines
  WHERE id IS NOT DISTINCT FROM $3::uuid
    AND NOT EXISTS (SELECT 1 FROM blocked)
  RETURNING id
)
UPDATE rental_bookings b
SET status = $4::public.rental_booking_status_enum,
    payment_status = $5::public.rental_booking_payment_status_enum,
    contract_expires_at = $6::timestamptz,
    condition_declined_at = NULL
WHERE b.id = $2::uuid
  AND b.status = 'cancelled'
  AND NOT EXISTS (SELECT 1 FROM blocked)
  AND NOT EXISTS (
    SELECT 1 FROM rental_condition_declines d WHERE d.rental_booking_id = b.id
  )
RETURNING b.id
`;
