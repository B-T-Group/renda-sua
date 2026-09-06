import { HttpException, HttpStatus } from '@nestjs/common';

export const REDIS_UNAVAILABLE_MESSAGE =
  'Temporarily unable to complete this request';

const REDIS_STACK = /@redis\/client|commands-queue|node_modules\/redis/i;

const REDIS_ERROR_NAMES = new Set([
  'AbortError',
  'TimeoutError',
  'ConnectionTimeoutError',
  'SocketClosedUnexpectedlyError',
  'ClientClosedError',
  'ClientOfflineError',
  'DisconnectsClientError',
  'CommandTimeoutDuringMaintenanceError',
]);

const REDIS_MESSAGE_PATTERNS = [
  /operation was aborted/i,
  /command timed out/i,
  /the queue is full/i,
  /connection is closed/i,
  /socket closed/i,
  /client is closed/i,
];

const REDIS_TRANSPORT_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'ENOTFOUND',
]);

type ErrorFields = {
  name?: string;
  message?: string;
  code?: string;
  stack?: string;
};

export function isTransientRedisError(error: unknown): boolean {
  const err = asErrorFields(error);
  if (!err) return false;
  if (err.name && REDIS_ERROR_NAMES.has(err.name)) return true;
  if (matchesRedisMessage(err.message)) return true;
  return isRedisTransport(err) || isEmptyRedisAbort(err);
}

export function throwRedisUnavailable(): never {
  throw new HttpException(
    {
      success: false,
      error: REDIS_UNAVAILABLE_MESSAGE,
      message: REDIS_UNAVAILABLE_MESSAGE,
    },
    HttpStatus.SERVICE_UNAVAILABLE
  );
}

export async function redisCommandOrFallback<T>(options: {
  canUseRedis: boolean;
  failClosed: boolean;
  redisOp: () => Promise<T>;
  fallbackOp: () => Promise<T> | T;
  onError?: (error: unknown) => void;
  waitForReady?: () => Promise<boolean>;
}): Promise<T> {
  const ready = options.canUseRedis || (await becameReady(options.waitForReady));
  if (!ready) {
    return options.failClosed ? throwRedisUnavailable() : options.fallbackOp();
  }
  try {
    return await options.redisOp();
  } catch (error: unknown) {
    options.onError?.(error);
    return options.failClosed ? throwRedisUnavailable() : options.fallbackOp();
  }
}

async function becameReady(
  waitForReady?: () => Promise<boolean>
): Promise<boolean> {
  return waitForReady ? waitForReady() : false;
}

function asErrorFields(error: unknown): ErrorFields | null {
  if (!error || typeof error !== 'object') return null;
  return error as ErrorFields;
}

function matchesRedisMessage(message?: string): boolean {
  return !!message && REDIS_MESSAGE_PATTERNS.some((re) => re.test(message));
}

function isRedisTransport(err: ErrorFields): boolean {
  return !!err.code && REDIS_TRANSPORT_CODES.has(err.code) && REDIS_STACK.test(err.stack || '');
}

function isEmptyRedisAbort(err: ErrorFields): boolean {
  const emptyMessage = !err.message || err.message === 'Error';
  const genericName = !err.name || err.name === 'Error';
  return emptyMessage && genericName && REDIS_STACK.test(err.stack || '');
}
