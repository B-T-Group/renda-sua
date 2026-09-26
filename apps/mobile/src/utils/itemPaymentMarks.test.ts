import { describe, expect, it } from 'vitest';
import { itemPaymentMarks } from './itemPaymentMarks';

describe('itemPaymentMarks', () => {
  it('shows one Cameroon mark for MTN MoMo and Orange Money', () => {
    expect(itemPaymentMarks({ method: 'mobile_money', countryIsos: ['CM'] })).toEqual(['cm']);
  });

  it('shows Airtel and Moov for Gabon items', () => {
    expect(itemPaymentMarks({ method: 'mobile_money', countryIsos: ['ga'] })).toEqual([
      'airtel',
      'moov',
    ]);
  });

  it('shows a card for Stripe countries and card rails', () => {
    expect(itemPaymentMarks({ method: 'mobile_money', countryIsos: ['CA'] })).toEqual(['card']);
    expect(itemPaymentMarks({ method: 'stripe', countryIsos: ['CM'] })).toEqual(['card']);
  });

  it('uses a generic mark when the country has no known method', () => {
    expect(itemPaymentMarks({ method: 'mobile_money', countryIsos: ['NG'] })).toEqual([
      'generic',
    ]);
    expect(itemPaymentMarks({ method: 'mobile_money' })).toEqual(['generic']);
  });
});
