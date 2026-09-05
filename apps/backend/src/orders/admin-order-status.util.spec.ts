import {
  ADMIN_STATUS_OVERRIDE_VALUES,
  isAdminOperationalStatus,
  isAdminSettlementStatus,
  isAdminTerminalStatus,
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
});
