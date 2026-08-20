import { HttpException, HttpStatus } from '@nestjs/common';

const RETRYABLE_STATUS = new Set([502, 503, 504]);
const RETRYABLE_ERRNO = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'ENOTFOUND',
  'EAI_AGAIN',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
  'UND_ERR_HEADERS_TIMEOUT',
]);

export type HasuraRetryOptions = {
  maxAttempts?: number;
  delaysMs?: number[];
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export function hasuraResponseStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('response' in error)) {
    return undefined;
  }
  const status = (error as { response?: { status?: unknown } }).response
    ?.status;
  return typeof status === 'number' ? status : undefined;
}

export function isRetryableHasuraError(error: unknown): boolean {
  const status = hasuraResponseStatus(error);
  if (status !== undefined) {
    return RETRYABLE_STATUS.has(status);
  }
  return isTransientNetworkError(error);
}

function isTransientNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const err = error as { name?: string; code?: string; message?: string };
  if (err.name === 'FetchError') {
    return true;
  }
  if (err.code && RETRYABLE_ERRNO.has(err.code)) {
    return true;
  }
  const message = String(err.message || '');
  return isNetworkFailureMessage(message);
}

function isNetworkFailureMessage(message: string): boolean {
  if (message.includes('request to ') && message.includes(' failed, reason:')) {
    return true;
  }
  return (
    message.includes('ECONNRESET') ||
    message.includes('socket hang up') ||
    message.includes('network timeout')
  );
}

export async function requestHasuraWithRetry<T>(
  requestFn: () => Promise<T>,
  options: HasuraRetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const delaysMs = options.delaysMs ?? [50, 200];
  const sleep = options.sleep ?? defaultSleep;
  return runHasuraAttempts(requestFn, maxAttempts, delaysMs, sleep);
}

async function runHasuraAttempts<T>(
  requestFn: () => Promise<T>,
  maxAttempts: number,
  delaysMs: number[],
  sleep: (ms: number) => Promise<void>
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await requestFn();
    } catch (error: any) {
      lastError = error;
      if (!shouldRetryHasura(error, attempt, maxAttempts)) {
        throw error;
      }
      await sleep(delaysMs[attempt - 1] ?? delaysMs[delaysMs.length - 1] ?? 0);
    }
  }
  throw lastError;
}

function shouldRetryHasura(
  error: unknown,
  attempt: number,
  maxAttempts: number
): boolean {
  return attempt < maxAttempts && isRetryableHasuraError(error);
}

export function toHasuraHttpException(
  error: unknown,
  fallback: string
): HttpException {
  if (error instanceof HttpException) {
    return error;
  }
  if (isRetryableHasuraError(error)) {
    return unavailableHasuraException(error);
  }
  return internalHasuraException(error, fallback);
}

export function throwMappedHasuraError(
  error: unknown,
  fallback: string
): never {
  throw toHasuraHttpException(error, fallback);
}

function unavailableHasuraException(error: unknown): HttpException {
  const body = {
    success: false,
    error: 'Service temporarily unavailable',
    message: 'Service temporarily unavailable',
  };
  return new HttpException(body, HttpStatus.SERVICE_UNAVAILABLE, {
    cause: asError(error),
  });
}

function internalHasuraException(
  error: unknown,
  fallback: string
): HttpException {
  const detail = errorMessage(error, fallback);
  return new HttpException(
    { success: false, error: detail, message: detail },
    HttpStatus.INTERNAL_SERVER_ERROR,
    { cause: asError(error) }
  );
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function asError(error: unknown): Error | undefined {
  return error instanceof Error ? error : undefined;
}
