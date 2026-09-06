import {
  idempotencyRetryDelayMs,
  isStripeIdempotencyInProgressError,
  retryStripeIdempotencyInProgress,
} from './stripe-idempotency';

describe('stripe-idempotency', () => {
  it('detects Stripe in-progress idempotency conflicts', () => {
    expect(
      isStripeIdempotencyInProgressError({
        message:
          'There is currently another in-progress request using this Idempotent Key (that probably means you submitted twice, and the other request is still going through): connect_account_user-123. Please try again later.',
      })
    ).toBe(true);
    expect(
      isStripeIdempotencyInProgressError({
        raw: {
          message:
            'There is currently another in-progress request using this Idempotent Key: connect_account_user-123',
        },
      })
    ).toBe(true);
    expect(isStripeIdempotencyInProgressError(new Error('card_declined'))).toBe(
      false
    );
  });

  it('backs off between retries and then returns the successful result', async () => {
    const delays: number[] = [];
    const operation = jest
      .fn()
      .mockRejectedValueOnce({
        message:
          'There is currently another in-progress request using this Idempotent Key: connect_account_user-123',
      })
      .mockResolvedValueOnce({ id: 'acct_123' });

    await expect(
      retryStripeIdempotencyInProgress(operation, async (ms) => {
        delays.push(ms);
      })
    ).resolves.toEqual({ id: 'acct_123' });

    expect(operation).toHaveBeenCalledTimes(2);
    expect(delays).toEqual([idempotencyRetryDelayMs(1)]);
  });

  it('rethrows non-idempotency errors without retrying', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('card_declined'));
    const delayFn = jest.fn();

    await expect(
      retryStripeIdempotencyInProgress(operation, delayFn)
    ).rejects.toThrow('card_declined');
    expect(operation).toHaveBeenCalledTimes(1);
    expect(delayFn).not.toHaveBeenCalled();
  });

  it('rethrows after the last in-progress attempt', async () => {
    const error = {
      message:
        'There is currently another in-progress request using this Idempotent Key: connect_account_user-123',
    };
    const operation = jest.fn().mockRejectedValue(error);

    await expect(
      retryStripeIdempotencyInProgress(operation, async () => undefined, 2)
    ).rejects.toEqual(error);
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
