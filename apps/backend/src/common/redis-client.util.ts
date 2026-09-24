import { createClient, RedisClientType } from 'redis';

export type RedisSocketConfig = {
  host: string;
  port: number;
  password?: string;
};

export const REDIS_READY_WAIT_MS = 2000;
export const REDIS_CONNECT_RETRY_DELAYS_MS = [500, 1000, 2000, 4000] as const;
const REDIS_RECONNECT_MAX_DELAY_MS = 3000;
const REDIS_RECONNECT_MAX_ATTEMPTS = 20;

const CONNECTION_NOISE_CODES = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EPIPE',
]);

const CONNECTION_NOISE_NAMES = new Set([
  'ConnectionTimeoutError',
  'TimeoutError',
  'SocketClosedUnexpectedlyError',
]);

const CONNECTION_NOISE_MESSAGES = [
  /connection timeout/i,
  /connect timeout/i,
  /socket closed/i,
  /connection is closed/i,
];

export function createAppRedisClient(
  redis: RedisSocketConfig
): RedisClientType {
  return createClient({
    socket: {
      host: redis.host,
      port: redis.port,
      connectTimeout: 5000,
      reconnectStrategy: redisReconnectDelay,
    },
    password: redis.password,
  });
}

/** Backoff for node-redis reconnect; stop after REDIS_RECONNECT_MAX_ATTEMPTS. */
export function redisReconnectDelay(retries: number): number | Error {
  if (retries >= REDIS_RECONNECT_MAX_ATTEMPTS) {
    return new Error('Redis reconnect exhausted');
  }
  return Math.min(retries * 100, REDIS_RECONNECT_MAX_DELAY_MS);
}

/** Transient socket noise that should not be logged at error. */
export function isRedisConnectionNoise(error: unknown): boolean {
  const err = error as { name?: string; message?: string; code?: string };
  if (!err || typeof err !== 'object') return false;
  if (err.name && CONNECTION_NOISE_NAMES.has(err.name)) return true;
  if (err.code && CONNECTION_NOISE_CODES.has(err.code)) return true;
  const msg = err.message || '';
  return CONNECTION_NOISE_MESSAGES.some((re) => re.test(msg));
}

export function formatRedisHostLabel(redis: {
  host: string;
  port: number;
}): string {
  return `host=${redis.host}:${redis.port}`;
}

export async function sleepMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function connectRedisWithRetry(options: {
  connect: () => Promise<void>;
  delaysMs?: readonly number[];
  onRetry: (attempt: number, error: unknown) => void;
}): Promise<void> {
  const delays = options.delaysMs ?? REDIS_CONNECT_RETRY_DELAYS_MS;
  let lastError: unknown = new Error('Redis connect failed');
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      await options.connect();
      return;
    } catch (error: unknown) {
      lastError = error;
      if (attempt === delays.length) break;
      options.onRetry(attempt + 1, error);
      await sleepMs(delays[attempt]);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Redis connect failed');
}

export function waitForRedisReady(options: {
  isReady: () => boolean;
  subscribe: (onReady: () => void) => () => void;
  timeoutMs?: number;
}): Promise<boolean> {
  if (options.isReady()) return Promise.resolve(true);
  return raceReady(options);
}

function raceReady(options: {
  isReady: () => boolean;
  subscribe: (onReady: () => void) => () => void;
  timeoutMs?: number;
}): Promise<boolean> {
  const timeoutMs = options.timeoutMs ?? REDIS_READY_WAIT_MS;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(value);
    };
    const unsubscribe = options.subscribe(() => finish(true));
    const timer = setTimeout(() => finish(false), timeoutMs);
    if (options.isReady()) finish(true);
  });
}
