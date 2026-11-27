import { describe, expect, it } from 'vitest';
import { pickupCardOutcomeMessage } from './pickupCardOutcome';

const t = (_key: string, fallback: string) => fallback;

describe('pickupCardOutcomeMessage', () => {
  it('surfaces a missing payment sheet instead of closing silently', () => {
    expect(pickupCardOutcomeMessage('none', false, t)).toMatch(/couldn’t open the card payment/);
  });

  it('stays quiet when the rental already started', () => {
    expect(pickupCardOutcomeMessage('none', true, t)).toBeNull();
  });

  it('maps cancelled, failed and paid outcomes', () => {
    expect(pickupCardOutcomeMessage('cancelled', false, t)).toMatch(/Payment cancelled/);
    expect(pickupCardOutcomeMessage('failed', false, t)).toMatch(/didn’t go through/);
    expect(pickupCardOutcomeMessage('authorized', false, t)).toMatch(/Payment received/);
  });
});
