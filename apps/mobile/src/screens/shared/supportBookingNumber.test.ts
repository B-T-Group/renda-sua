import { supportBookingNumber } from './supportBookingNumber';

describe('supportBookingNumber', () => {
  it('keeps a rental booking number and drops other text', () => {
    expect(supportBookingNumber(' RB-25496310 ')).toBe('RB-25496310');
    expect(supportBookingNumber('not a booking')).toBe('');
  });
});
