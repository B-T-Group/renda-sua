import { motionDuration } from './motion';

describe('motionDuration', () => {
  it('uses the token when motion is allowed', () => {
    expect(motionDuration('fast', false)).toBe(120);
    expect(motionDuration('normal', false)).toBe(200);
    expect(motionDuration('slow', false)).toBe(320);
  });

  it('collapses to zero when reduce motion is on', () => {
    expect(motionDuration('fast', true)).toBe(0);
    expect(motionDuration('slow', true)).toBe(0);
  });
});
