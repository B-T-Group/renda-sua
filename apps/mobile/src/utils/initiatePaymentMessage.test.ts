import { describe, expect, it } from 'vitest';
import { initiatePaymentUserMessage } from './initiatePaymentMessage';

describe('initiatePaymentUserMessage', () => {
  it('prefers the top-level message', () => {
    expect(
      initiatePaymentUserMessage({
        message: 'Invalid withdrawal PIN',
        data: { transactionId: '1', message: 'nested' },
      })
    ).toBe('Invalid withdrawal PIN');
  });

  it('uses data.message when the top-level message is missing', () => {
    expect(
      initiatePaymentUserMessage({
        data: {
          transactionId: '1',
          message: 'Insufficient balance or you have much withdraw in progress',
          provider: 'freemopay',
        },
      })
    ).toBe('Insufficient balance or you have much withdraw in progress');
  });

  it('returns undefined when neither message is present', () => {
    expect(initiatePaymentUserMessage({})).toBeUndefined();
  });
});
