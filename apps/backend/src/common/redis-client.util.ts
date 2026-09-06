import { createClient, RedisClientType } from 'redis';

export type RedisSocketConfig = {
  host: string;
  port: number;
  password?: string;
};

export const REDIS_READY_WAIT_MS = 2000;
export const REDIS_CONNECT_RETRY_DELAYS_MS = [500, 1000, 2000, 4000] as const;

export function createAppRedisClient(
  redis: RedisSocketConfig
): RedisClientType {
  return createClient({
    socket: {
      host: redis.host,
      port: redis.port,
      connectTimeout: 5000,
    },
    password: redis.password,
  });
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
