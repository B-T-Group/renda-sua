import { supportBookingNumber } from './supportBookingNumber';

describe('supportBookingNumber', () => {
  it('keeps a rental booking number and drops other text', () => {
    expect(supportBookingNumber(' RB-25496310 ')).toBe('RB-25496310');
    expect(supportBookingNumber('RB-2')).toBe('');
    expect(supportBookingNumber('<script>alert(1)</script>')).toBe('');
    expect(supportBookingNumber('RB-25496310 extra')).toBe('');
  });
});
