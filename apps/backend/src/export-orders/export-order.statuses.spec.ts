import {
  assertTransition,
  EXPORT_TRANSITIONS,
} from './export-order.statuses';

describe('export order transitions', () => {
  it('allows SUBMITTED → IN_REVIEW', () => {
    expect(() => assertTransition('SUBMITTED', 'IN_REVIEW')).not.toThrow();
  });

  it('refuses SUBMITTED → SHIPPED', () => {
    expect(() => assertTransition('SUBMITTED', 'SHIPPED')).toThrow(
      /Invalid export order transition/
    );
  });

  it('blocks SHIPPED until PAID_IN_FULL or FINANCED_*', () => {
    expect(EXPORT_TRANSITIONS.PAID_IN_FULL).toContain('SHIPPED');
    expect(EXPORT_TRANSITIONS.FINANCED_30).toContain('SHIPPED');
    expect(EXPORT_TRANSITIONS.BALANCE_REQUIRED).not.toContain('SHIPPED');
  });
});
