import { HttpException, HttpStatus } from '@nestjs/common';
import {
  isTransientRedisError,
  redisCommandOrFallback,
  REDIS_UNAVAILABLE_MESSAGE,
  throwRedisUnavailable,
} from './redis-error.util';

function redisAbortError(): Error {
  const error = new Error();
  error.stack = [
    'Error',
    '    at AbortSignal.? (node_modules/redis/node_modules/@redis/client/lib/client/commands-queue.ts:298:13)',
  ].join('\n');
  return error;
}

describe('redis-error.util', () => {
  it('detects empty Error from node-redis AbortSignal timeout', () => {
    expect(isTransientRedisError(redisAbortError())).toBe(true);
  });

  it('detects named Redis timeout and abort errors', () => {
    expect(isTransientRedisError({ name: 'TimeoutError' })).toBe(true);
    expect(isTransientRedisError({ name: 'AbortError' })).toBe(true);
    expect(
      isTransientRedisError({
        message: 'The operation was aborted due to timeout',
      })
    ).toBe(true);
  });

  it('detects Redis socket codes only when the stack is Redis', () => {
    expect(
      isTransientRedisError({
        code: 'ECONNRESET',
        stack: 'Error\n    at node_modules/@redis/client/dist/lib/client/socket.js',
      })
    ).toBe(true);
    expect(isTransientRedisError({ code: 'ECONNRESET' })).toBe(false);
  });

  it('does not treat unrelated errors as Redis failures', () => {
    expect(isTransientRedisError(new Error('unexpected'))).toBe(false);
    expect(isTransientRedisError({ message: 'User not found' })).toBe(false);
    expect(isTransientRedisError(null)).toBe(false);
  });

  it('throws a 503 HttpException for Redis unavailability', () => {
    try {
      throwRedisUnavailable();
      fail('expected HttpException');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(error.getResponse()).toEqual({
        success: false,
        error: REDIS_UNAVAILABLE_MESSAGE,
        message: REDIS_UNAVAILABLE_MESSAGE,
      });
      expect(error.message).toBe(REDIS_UNAVAILABLE_MESSAGE);
    }
  });

  it('falls back in development when a Redis command aborts', async () => {
    const onError = jest.fn();
    const actual = await redisCommandOrFallback({
      canUseRedis: true,
      failClosed: false,
      redisOp: async () => {
        throw redisAbortError();
      },
      fallbackOp: () => 'memory',
      onError,
    });
    expect(actual).toBe('memory');
    expect(onError).toHaveBeenCalled();
  });

  it('fails closed in production when a Redis command aborts', async () => {
    await expect(
      redisCommandOrFallback({
        canUseRedis: true,
        failClosed: true,
        redisOp: async () => {
          throw redisAbortError();
        },
        fallbackOp: () => 'memory',
      })
    ).rejects.toMatchObject({ status: HttpStatus.SERVICE_UNAVAILABLE });
  });

  it('waits for Redis ready before running the command', async () => {
    const redisOp = jest.fn().mockResolvedValue('ok');
    const actual = await redisCommandOrFallback({
      canUseRedis: false,
      failClosed: true,
      redisOp,
      fallbackOp: () => 'memory',
      waitForReady: async () => true,
    });
    expect(actual).toBe('ok');
    expect(redisOp).toHaveBeenCalled();
  });

  it('fails closed when waitForReady times out', async () => {
    await expect(
      redisCommandOrFallback({
        canUseRedis: false,
        failClosed: true,
        redisOp: async () => 'ok',
        fallbackOp: () => 'memory',
        waitForReady: async () => false,
      })
    ).rejects.toMatchObject({ status: HttpStatus.SERVICE_UNAVAILABLE });
  });
});
