import { REVERT_UNPAID_DECLINE } from './decline-revert';

/**
 * Postgres does not show a CTE delete to the rest of that statement.
 * The booking update has to use the delete's RETURNING rows.
 */
describe('REVERT_UNPAID_DECLINE', () => {
  const sql = REVERT_UNPAID_DECLINE;

  it('restores from the delete result in the same statement', () => {
    expect(sql.split(';').filter((part) => part.trim())).toHaveLength(1);
    expect(sql).toContain('EXISTS (SELECT 1 FROM removed) OR $3::uuid IS NULL');
    expect(sql).toContain('DELETE FROM rental_condition_declines');
    expect(sql).toContain('id IS NOT DISTINCT FROM $3::uuid');
    expect(sql).toContain('d.id IS DISTINCT FROM $3::uuid');
    expect(sql).toContain(`SET status = $4::public.rental_booking_status_enum,
    payment_status = $5::public.rental_booking_payment_status_enum,
    contract_expires_at = $6::timestamptz`);
    expect(sql).toContain("AND b.status = 'cancelled'");
    expect(sql).toContain('condition_declined_at = NULL');
  });

  it('blocks both the delete and the restore when a debit or a payout exists', () => {
    expect(sql).toContain('idempotency_key = $1');
    expect(sql).toContain('WHERE id = $2::uuid');
    expect(sql).toContain('refund_provider_ref IS NOT NULL');
    expect(sql).toContain('refund_sent_at IS NOT NULL');
    expect(sql).toContain("COALESCE(refund_status, 'none') <> 'none'");
    expect(sql.split('NOT EXISTS (SELECT 1 FROM blocked)').length - 1).toBe(2);
  });
});
