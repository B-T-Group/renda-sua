import { normalizeProviderMessage } from './normalize-provider-message';

describe('normalizeProviderMessage', () => {
  it('returns strings unchanged', () => {
    expect(normalizeProviderMessage('Payment failed')).toBe('Payment failed');
  });

  it('prefers en from bilingual Freemopay payloads', () => {
    expect(
      normalizeProviderMessage({
        en: 'Insufficient balance or your have much withdraw in progress',
        fr: 'Solde insuffisant ou vous avez trop de retrait en cours ',
      })
    ).toBe('Insufficient balance or your have much withdraw in progress');
  });

  it('falls back to fr when en is missing', () => {
    expect(
      normalizeProviderMessage({
        fr: 'Solde insuffisant',
      })
    ).toBe('Solde insuffisant');
  });

  it('uses fallback for null/empty', () => {
    expect(normalizeProviderMessage(null)).toBe('Payment failed');
    expect(normalizeProviderMessage('')).toBe('Payment failed');
    expect(normalizeProviderMessage(undefined, 'Custom')).toBe('Custom');
  });

  it('reads message/reason/error keys when en/fr are absent', () => {
    expect(normalizeProviderMessage({ message: ' Declined ' })).toBe('Declined');
    expect(normalizeProviderMessage({ reason: 'Timeout' })).toBe('Timeout');
    expect(normalizeProviderMessage({ error: 'Network' })).toBe('Network');
  });

  it('stringifies leftover objects and coerces primitives', () => {
    expect(normalizeProviderMessage({ code: 400 })).toBe('{"code":400}');
    expect(normalizeProviderMessage(404)).toBe('404');
  });
});
