import { verifyBoldSignWebhookSecret } from './boldsign-webhook-auth.util';

describe('verifyBoldSignWebhookSecret', () => {
  it('returns true when secrets match', () => {
    expect(verifyBoldSignWebhookSecret('my-secret', 'my-secret')).toBe(true);
  });

  it('returns false when secrets differ', () => {
    expect(verifyBoldSignWebhookSecret('wrong', 'my-secret')).toBe(false);
  });

  it('returns false when expected secret is missing', () => {
    expect(verifyBoldSignWebhookSecret('my-secret', undefined)).toBe(false);
    expect(verifyBoldSignWebhookSecret('my-secret', '')).toBe(false);
  });

  it('returns false when provided secret is missing', () => {
    expect(verifyBoldSignWebhookSecret(undefined, 'my-secret')).toBe(false);
    expect(verifyBoldSignWebhookSecret('', 'my-secret')).toBe(false);
  });
});
