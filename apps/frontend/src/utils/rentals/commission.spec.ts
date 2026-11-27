import { commissionPercent } from './commission';

describe('commissionPercent', () => {
  it('renders basis points as a percent', () => {
    expect(commissionPercent(1500)).toBe('15');
    expect(commissionPercent(1250)).toBe('12.5');
    expect(commissionPercent(0)).toBe('0');
  });
});
