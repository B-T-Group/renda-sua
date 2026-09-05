import {
  buildMomoAwaitingPaymentTo,
  momoAwaitingStorageKey,
  parseMomoAwaitingPaymentParams,
} from './momoAwaitingPaymentNav';

describe('momoAwaitingPaymentNav', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('encodes poll fields in the search string', () => {
    const to = buildMomoAwaitingPaymentTo({
      orderIds: ['a', 'b'],
      phoneE164: '+237670000000',
      source: 'checkout',
      orderNumbers: ['ORD-1', 'ORD-2'],
      confirmationState: { orders: [{ id: 'a' }] },
    });
    expect(to.pathname).toBe('/orders/awaiting-payment');
    expect(to.search).toContain('orderIds=a%2Cb');
    expect(to.search).toContain('phone=%2B237670000000');
    expect(to.search).toContain('source=checkout');
    expect(to.search).toContain('orderNumbers=ORD-1%2CORD-2');
    expect(sessionStorage.getItem(momoAwaitingStorageKey(['a', 'b']))).toContain(
      '"id":"a"'
    );
  });

  it('restores params from search after a refresh (no location.state)', () => {
    sessionStorage.setItem(
      momoAwaitingStorageKey(['ord-1']),
      JSON.stringify({ order: { id: 'ord-1' } })
    );
    const parsed = parseMomoAwaitingPaymentParams(
      '?orderIds=ord-1&phone=%2B2416000000&source=pickup&orderNumbers=ORD-9',
      null
    );
    expect(parsed).toEqual({
      orderIds: ['ord-1'],
      phoneE164: '+2416000000',
      source: 'pickup',
      orderNumbers: ['ORD-9'],
      confirmationState: { order: { id: 'ord-1' } },
    });
  });

  it('falls back to location.state when search is empty', () => {
    const parsed = parseMomoAwaitingPaymentParams('', {
      orderIds: ['x'],
      phoneE164: '+1',
      source: 'retry',
    });
    expect(parsed.orderIds).toEqual(['x']);
    expect(parsed.source).toBe('retry');
  });
});
