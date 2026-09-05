import {
  buildOrderAcceptanceEscalationStatusLabel,
  buildOrderAcceptanceReminderPushMessage,
} from './wallet-credit-push.messages';

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

describe('buildOrderAcceptanceReminderPushMessage', () => {
  it('names the remaining 45-minute window in English and French', () => {
    expect(
      buildOrderAcceptanceReminderPushMessage({
        orderNumber: 'RS-1',
        preferredLanguage: 'en',
        remainingSeconds: 2700,
      })
    ).toEqual({
      title: 'Still waiting',
      body: 'Confirm order RS-1 — 45 minutes left',
    });
    expect(
      buildOrderAcceptanceReminderPushMessage({
        orderNumber: 'RS-1',
        preferredLanguage: 'fr',
        remainingSeconds: 2700,
      })
    ).toEqual({
      title: 'Toujours en attente',
      body: 'Confirmez la commande RS-1 — il vous reste 45 minutes',
    });
  });

  it('never labels a zero-second remainder as expired', () => {
    expect(
      buildOrderAcceptanceReminderPushMessage({
        orderNumber: 'RS-1',
        preferredLanguage: 'en',
        remainingSeconds: 0,
      }).body
    ).toBe('Confirm order RS-1 — 1 second left');
  });
});

