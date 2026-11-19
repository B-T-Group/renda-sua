/**
 * One statement. A data-modifying CTE is not visible to the rest of that
 * statement, so the booking update ignores the decline id this statement
 * deletes and runs only when that delete returned a row. A null decline id
 * still restores when no decline row remains, so a failed insert can be retried.
 * A debit or a payout blocks both the delete and the restore.
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
  AND (EXISTS (SELECT 1 FROM removed) OR $3::uuid IS NULL)
  AND NOT EXISTS (
    SELECT 1 FROM rental_condition_declines d
    WHERE d.rental_booking_id = b.id
      AND d.id IS DISTINCT FROM $3::uuid
  )
RETURNING b.id
`;
