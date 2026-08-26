import { buildOrderAcceptanceEscalationStatusLabel } from './wallet-credit-push.messages';

describe('buildOrderAcceptanceEscalationStatusLabel', () => {
  it('tells the merchant how long is left before cancellation', () => {
    expect(
      buildOrderAcceptanceEscalationStatusLabel({
        preferredLanguage: 'en',
        graceSeconds: 300,
      })
    ).toBe('waiting for your confirmation — 5 minutes before cancellation');
  });

  it('defaults to French, the platform default for merchant copy', () => {
    expect(
      buildOrderAcceptanceEscalationStatusLabel({ graceSeconds: 300 })
    ).toBe('en attente de votre confirmation — 5 minutes avant annulation');
  });

  it('still conveys urgency without a configured grace window', () => {
    expect(
      buildOrderAcceptanceEscalationStatusLabel({ preferredLanguage: 'en' })
    ).toBe('waiting for your confirmation — cancellation imminent');
    expect(
      buildOrderAcceptanceEscalationStatusLabel({
        preferredLanguage: 'en',
        graceSeconds: 0,
      })
    ).toBe('waiting for your confirmation — cancellation imminent');
  });
});
