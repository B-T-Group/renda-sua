import {
  ADMIN_FULL_REFUND_NOTES_PREFIX,
  ADMIN_STATUS_OVERRIDE_VALUES,
  adminFullRefundNotes,
  isAdminOperationalStatus,
  isAdminSettlementStatus,
  isAdminTerminalStatus,
  isResumableAdminFullRefundCancel,
} from './admin-order-status.util';

describe('admin-order-status.util', () => {
  it('treats cancelled and delivered as terminal', () => {
    expect(isAdminTerminalStatus('cancelled')).toBe(true);
    expect(isAdminTerminalStatus('delivered')).toBe(true);
    expect(isAdminTerminalStatus('complete')).toBe(true);
    expect(isAdminTerminalStatus('confirmed')).toBe(false);
  });

  it('blocks settlement statuses that skip capture or payouts', () => {
    expect(isAdminSettlementStatus('delivered')).toBe(true);
    expect(isAdminSettlementStatus('picked_up')).toBe(true);
    expect(isAdminSettlementStatus('complete')).toBe(true);
    expect(isAdminSettlementStatus('confirmed')).toBe(false);
    expect(isAdminSettlementStatus('cancelled')).toBe(false);
  });

  it('allows only operational mid-flow overrides plus cancel', () => {
    expect(isAdminOperationalStatus('ready_for_pickup')).toBe(true);
    expect(isAdminOperationalStatus('picked_up')).toBe(false);
    expect(ADMIN_STATUS_OVERRIDE_VALUES).toContain('cancelled');
    expect(ADMIN_STATUS_OVERRIDE_VALUES).not.toContain('delivered');
    expect(ADMIN_STATUS_OVERRIDE_VALUES).not.toContain('picked_up');
  });

  it('resumes only a system full-refund cancel (not a client cancel)', () => {
    expect(adminFullRefundNotes('QA leftover')).toBe(`${ADMIN_FULL_REFUND_NOTES_PREFIX} QA leftover`);
    expect(
      isResumableAdminFullRefundCancel({
        current_status: 'cancelled',
        cancelled_by: 'system',
        cancellation_notes: adminFullRefundNotes('QA leftover'),
      })
    ).toBe(true);
    expect(
      isResumableAdminFullRefundCancel({
        current_status: 'cancelled',
        cancelled_by: 'client',
        cancellation_notes: adminFullRefundNotes('QA leftover'),
      })
    ).toBe(false);
    expect(
      isResumableAdminFullRefundCancel({
        current_status: 'cancelled',
        cancelled_by: 'system',
        cancellation_notes: 'ops cleanup',
      })
    ).toBe(false);
    expect(
      isResumableAdminFullRefundCancel({
        current_status: 'confirmed',
        cancelled_by: 'system',
        cancellation_notes: adminFullRefundNotes('QA leftover'),
      })
    ).toBe(false);
  });
});
