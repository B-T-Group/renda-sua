import { describe, expect, it } from 'vitest';
import { claimAwaitingParams, claimHoldTransactionId } from './claimAwaitingNav';

const base = {
  orderId: 'order-1',
  orderNumber: 'ORD-9',
  phoneE164: '+237600000000',
  currency: 'XAF',
};

describe('claimAwaitingParams', () => {
  it('opens the awaiting screen on the local payment id and the charged phone', () => {
    expect(
      claimAwaitingParams({
        ...base,
        response: {
          success: true,
          message: 'ok',
          phoneNumber: '+241077000000',
          paymentTransaction: { id: ' tx-local ', transactionId: 'prov-1' },
        },
      })
    ).toEqual({
      orderId: 'order-1',
      orderNumber: 'ORD-9',
      phoneE164: '+241077000000',
      transactionId: 'tx-local',
      currency: 'XAF',
    });
  });

  it('does not navigate when the response has no local payment id', () => {
    expect(
      claimAwaitingParams({
        ...base,
        response: {
          success: true,
          message: 'ok',
          paymentTransaction: { id: '  ', transactionId: 'prov-1' },
        },
      })
    ).toBeNull();
    expect(
      claimAwaitingParams({
        ...base,
        response: { success: true, message: 'ok' },
      })
    ).toBeNull();
  });

  it('keeps the typed phone when the response phone is blank', () => {
    expect(
      claimAwaitingParams({
        ...base,
        response: {
          success: true,
          message: 'ok',
          phoneNumber: '',
          paymentTransaction: { id: 'tx-local' },
        },
      })?.phoneE164
    ).toBe('+237600000000');
  });
});

describe('claimHoldTransactionId', () => {
  it('returns a trimmed local id and rejects a failed or blank retry', () => {
    expect(
      claimHoldTransactionId({
        success: true,
        paymentTransaction: { id: ' tx-2 ' },
      })
    ).toBe('tx-2');
    expect(() =>
      claimHoldTransactionId({
        success: false,
        message: 'Insufficient funds',
        paymentTransaction: { id: 'tx-2' },
      })
    ).toThrow('Insufficient funds');
    expect(() => claimHoldTransactionId({ success: true })).toThrow(
      'Failed to claim order'
    );
  });
});
