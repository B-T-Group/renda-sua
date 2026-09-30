import {
  buildClaimAwaitingPaymentTo,
  buildMomoAwaitingPaymentTo,
  claimHoldTransactionId,
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
      claimTransactionId: undefined,
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
    expect(parsed.claimTransactionId).toBeUndefined();
  });

  it('keeps a claim hold refreshable by transaction id', () => {
    const to = buildClaimAwaitingPaymentTo({
      orderId: 'order-1',
      orderNumber: 'ORD-9',
      phoneE164: '+237670000000',
      claimTransactionId: ' tx-local ',
    });
    expect(to.search).toContain('source=claim');
    expect(to.search).toContain('orderIds=order-1');
    expect(to.search).toContain('orderNumbers=ORD-9');

    const parsed = parseMomoAwaitingPaymentParams(to.search, null);
    expect(parsed.source).toBe('claim');
    expect(parsed.orderIds).toEqual(['order-1']);
    expect(parsed.orderNumbers).toEqual(['ORD-9']);
    expect(parsed.claimTransactionId).toBe('tx-local');
  });

  it('omits a blank claim transaction id from the refresh url', () => {
    const to = buildClaimAwaitingPaymentTo({
      orderId: 'order-1',
      phoneE164: '+237670000000',
    });
    expect(to.search).toContain('source=claim');
    expect(to.search).not.toContain('claimTransactionId');
    expect(to.search).not.toContain('orderNumbers');
  });

  it('does not treat an unknown source as a claim hold', () => {
    const parsed = parseMomoAwaitingPaymentParams(
      '?orderIds=order-1&source=wallet&claimTransactionId=%20%20',
      { claimTransactionId: 'tx-from-state', source: 'claim' }
    );
    expect(parsed.source).toBe('checkout');
    expect(parsed.claimTransactionId).toBe('tx-from-state');
  });

  it('refuses a claim retry that has no local payment id', () => {
    expect(
      claimHoldTransactionId({
        success: true,
        paymentTransaction: { id: ' tx-2 ' },
      })
    ).toBe('tx-2');
    expect(() =>
      claimHoldTransactionId({
        success: true,
        paymentTransaction: { id: '  ' },
      })
    ).toThrow('Failed to claim order with topup');
    expect(() =>
      claimHoldTransactionId({
        success: false,
        message: 'Wallet busy',
        paymentTransaction: { id: 'tx-2' },
      })
    ).toThrow('Wallet busy');
  });
});
