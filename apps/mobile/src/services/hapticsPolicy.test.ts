import { hapticAllowed } from './hapticsPolicy';

describe('hapticAllowed', () => {
  it('plays on native when motion is allowed', () => {
    expect(hapticAllowed('ios', false)).toBe(true);
    expect(hapticAllowed('android', false)).toBe(true);
  });

  it('stays quiet on web and when reduce motion is on', () => {
    expect(hapticAllowed('web', false)).toBe(false);
    expect(hapticAllowed('ios', true)).toBe(false);
    expect(hapticAllowed('android', true)).toBe(false);
  });
});
