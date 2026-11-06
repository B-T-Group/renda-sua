import { describe, expect, it } from 'vitest';
import { formatCheckoutEtaRange, formatWindowChoiceLabel } from './deliveryWindowUtils';
import { checkoutWindowSectionVisible, checkoutWindowStickyText } from './checkoutWindowSummary';

describe('checkoutWindowSectionVisible', () => {
  it('shows the time card for delivery and pickup once a region is known', () => {
    expect(
      checkoutWindowSectionVisible({
        confirmed: true,
        fulfillment: 'delivery',
        country: 'CM',
        state: 'LT',
      })
    ).toBe(true);
    expect(
      checkoutWindowSectionVisible({
        confirmed: true,
        fulfillment: 'pickup',
        country: ' ',
        state: 'LT',
      })
    ).toBe(false);
    expect(
      checkoutWindowSectionVisible({
        confirmed: true,
        fulfillment: 'shipping',
        country: 'CM',
        state: 'LT',
      })
    ).toBe(false);
  });
});

describe('checkoutWindowStickyText', () => {
  const base = {
    asapTitle: 'Deliver as soon as possible',
    etaLine: 'Usually ready Fri 10:07 AM–Fri 10:37 AM',
    missingLabel: 'Select a time slot',
  };

  it('echoes as soon as possible with the ready window', () => {
    expect(
      checkoutWindowStickyText({ ...base, needsChoice: false, windowLabel: null })
    ).toBe('Deliver as soon as possible · Usually ready Fri 10:07 AM–Fri 10:37 AM');
  });

  it('uses the chosen slot when one is scheduled', () => {
    expect(
      checkoutWindowStickyText({
        ...base,
        needsChoice: false,
        windowLabel: 'Sat, Nov 7 · Morning',
      })
    ).toBe('Sat, Nov 7 · Morning');
  });

  it('asks for a slot when scheduling is required', () => {
    expect(
      checkoutWindowStickyText({
        ...base,
        needsChoice: true,
        windowLabel: 'Sat, Nov 7 · Morning',
      })
    ).toBe('Select a time slot');
  });
});

describe('formatWindowChoiceLabel', () => {
  it('joins the date with the slot name and range', () => {
    const label = formatWindowChoiceLabel('2026-11-07', ['Morning', '10:00 – 12:00'], 'en-US');
    expect(label).toContain('Nov');
    expect(label).toContain('7');
    expect(label).toContain('Morning');
    expect(label).toContain('10:00 – 12:00');
  });
});

describe('formatCheckoutEtaRange', () => {
  it('returns null when both bounds are missing', () => {
    expect(formatCheckoutEtaRange(null, null)).toBeNull();
  });

  it('joins two different clocks', () => {
    const line = formatCheckoutEtaRange(
      '2026-11-07T15:07:00.000Z',
      '2026-11-07T15:37:00.000Z'
    );
    expect(line).toContain('–');
  });
});
