export const STRIPE_IDEMPOTENCY_IN_PROGRESS_MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 200;
const MAX_DELAY_MS = 2000;

export function isStripeIdempotencyInProgressError(error: unknown): boolean {
  const err = error as { message?: string; raw?: { message?: string } };
  const message = String(err?.raw?.message || err?.message || '');
  return message.includes(
    'another in-progress request using this Idempotent Key'
  );
}

export function idempotencyRetryDelayMs(attempt: number): number {
  return Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
}

export async function retryStripeIdempotencyInProgress<T>(
  operation: () => Promise<T>,
  delayFn: (ms: number) => Promise<void>,
  maxAttempts = STRIPE_IDEMPOTENCY_IN_PROGRESS_MAX_ATTEMPTS
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      throwOrContinueRetry(error, attempt, maxAttempts);
      await delayFn(idempotencyRetryDelayMs(attempt));
    }
  }
  throw new Error('Stripe idempotency retry exhausted');
}

function throwOrContinueRetry(
  error: any,
  attempt: number,
  maxAttempts: number
): void {
  const canRetry =
    isStripeIdempotencyInProgressError(error) && attempt < maxAttempts;
  if (!canRetry) throw error;
}
