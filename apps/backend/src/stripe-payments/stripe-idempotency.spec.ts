import {
  isStripeIdempotencyInProgress,
  retryOnStripeIdempotencyInProgress,
  STRIPE_IDEMPOTENCY_MAX_ATTEMPTS,
} from './stripe-idempotency';

const IN_PROGRESS = new Error(
  'There is currently another in-progress request using this Idempotent Key: connect_account_user-123. Please try again later.'
);

describe('stripe-idempotency', () => {
  const delay = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    delay.mockClear();
  });

  it('detects Stripe in-progress idempotency errors', () => {
    expect(isStripeIdempotencyInProgress(IN_PROGRESS)).toBe(true);
    expect(isStripeIdempotencyInProgress(new Error('card_declined'))).toBe(
      false
    );
  });

  it('retries in-progress errors and returns the later success', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(IN_PROGRESS)
      .mockResolvedValueOnce({ id: 'acct_123' });

    await expect(
      retryOnStripeIdempotencyInProgress(operation, delay)
    ).resolves.toEqual({ id: 'acct_123' });
    expect(operation).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledTimes(1);
  });

  it('rethrows after the retry budget is exhausted', async () => {
    const operation = jest.fn().mockRejectedValue(IN_PROGRESS);

    await expect(
      retryOnStripeIdempotencyInProgress(operation, delay)
    ).rejects.toBe(IN_PROGRESS);
    expect(operation).toHaveBeenCalledTimes(STRIPE_IDEMPOTENCY_MAX_ATTEMPTS);
    expect(delay).toHaveBeenCalledTimes(STRIPE_IDEMPOTENCY_MAX_ATTEMPTS - 1);
  });

  it('does not retry unrelated Stripe errors', async () => {
    const other = new Error('Your account is not set up to create accounts');
    const operation = jest.fn().mockRejectedValue(other);

    await expect(
      retryOnStripeIdempotencyInProgress(operation, delay)
    ).rejects.toBe(other);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
  });
});
