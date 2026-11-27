import {
  exportOrderStatusColor,
  exportOrderStatusLabel,
} from './exportOrderStatus';

const t = (_key: string, fallback: string) => fallback;

describe('exportOrderStatus', () => {
  it('labels known statuses and falls back to the raw code', () => {
    expect(exportOrderStatusLabel(t, 'PROFORMA_ISSUED')).toBe('Proforma ready');
    expect(exportOrderStatusLabel(t, 'SOMETHING_NEW')).toBe('SOMETHING_NEW');
  });

  it('asks the client to act on proforma, deposit, balance and delivery', () => {
    expect(exportOrderStatusColor('PROFORMA_ISSUED')).toBe('warning');
    expect(exportOrderStatusColor('SHIPPED')).toBe('warning');
    expect(exportOrderStatusColor('DELIVERED')).toBe('success');
    expect(exportOrderStatusColor('REJECTED')).toBe('error');
    expect(exportOrderStatusColor('SUBMITTED')).toBe('info');
    expect(exportOrderStatusColor('IN_PRODUCTION')).toBe('default');
  });
});
