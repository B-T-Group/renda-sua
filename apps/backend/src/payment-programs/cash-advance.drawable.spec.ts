import { drawableRemaining } from './cash-advance.service';

describe('drawableRemaining', () => {
  it('reduces the draw limit by the absolute cash-advance debt', () => {
    expect(drawableRemaining(10000, -2500)).toBe(7500);
    expect(drawableRemaining(10000, 0)).toBe(10000);
    expect(drawableRemaining(1000, -1000)).toBe(0);
  });
});
