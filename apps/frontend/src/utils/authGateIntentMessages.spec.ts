import {
  getAuthGateIntentErrorMessage,
  getAuthGateSuccessToast,
} from './authGateIntentMessages';

describe('authGateIntentMessages', () => {
  const t = (key: string, defaultValue: string) => defaultValue;

  it('returns success copy for foods cart', () => {
    expect(getAuthGateSuccessToast('foods_cart')).toMatchObject({
      defaultValue: 'Added to cart',
    });
  });

  it('maps sold-out API errors', () => {
    const msg = getAuthGateIntentErrorMessage(
      { response: { data: { message: 'Item sold out' } } },
      t
    );
    expect(msg).toBe('This item is no longer available.');
  });

  it('maps generic intent failures', () => {
    const msg = getAuthGateIntentErrorMessage(new Error('nope'), t);
    expect(msg).toContain("couldn't finish");
  });
});
