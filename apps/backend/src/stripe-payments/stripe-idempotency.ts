const IN_PROGRESS_MARKER = 'in-progress request using this Idempotent Key';

export const STRIPE_IDEMPOTENCY_MAX_ATTEMPTS = 5;
export const STRIPE_IDEMPOTENCY_DELAY_MS = 300;

export function isStripeIdempotencyInProgress(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return message.includes(IN_PROGRESS_MARKER);
}

export async function retryOnStripeIdempotencyInProgress<T>(
  operation: () => Promise<T>,
  delay: (ms: number) => Promise<void> = sleep
): Promise<T> {
  return retryWhile(operation, isStripeIdempotencyInProgress, delay);
}

async function retryWhile<T>(
  operation: () => Promise<T>,
  shouldRetry: (error: unknown) => boolean,
  delay: (ms: number) => Promise<void>
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      if (!shouldRetry(error) || attempt >= STRIPE_IDEMPOTENCY_MAX_ATTEMPTS) {
        throw error;
      }
      await delay(STRIPE_IDEMPOTENCY_DELAY_MS * attempt);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
