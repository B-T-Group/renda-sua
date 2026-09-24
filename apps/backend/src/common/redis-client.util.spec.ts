import {
  connectRedisWithRetry,
  isRedisConnectionNoise,
  redisReconnectDelay,
  waitForRedisReady,
} from './redis-client.util';

describe('redis-client.util', () => {
  it('retries connect until it succeeds', async () => {
    const connect = jest
      .fn()
      .mockRejectedValueOnce(new Error('refused'))
      .mockResolvedValueOnce(undefined);
    const onRetry = jest.fn();

    await connectRedisWithRetry({
      connect,
      delaysMs: [1],
      onRetry,
    });

    expect(connect).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });

  it('throws the last connect error after retries are exhausted', async () => {
    const connect = jest.fn().mockRejectedValue(new Error('refused'));

    await expect(
      connectRedisWithRetry({
        connect,
        delaysMs: [1],
        onRetry: jest.fn(),
      })
    ).rejects.toThrow('refused');
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('resolves immediately when Redis is already ready', async () => {
    const subscribe = jest.fn();
    await expect(
      waitForRedisReady({
        isReady: () => true,
        subscribe,
        timeoutMs: 20,
      })
    ).resolves.toBe(true);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('resolves when the ready event fires before timeout', async () => {
    let onReady: (() => void) | undefined;
    const pending = waitForRedisReady({
      isReady: () => false,
      subscribe: (listener) => {
        onReady = listener;
        return () => undefined;
      },
      timeoutMs: 200,
    });
    onReady?.();
    await expect(pending).resolves.toBe(true);
  });

  it('times out when Redis never becomes ready', async () => {
    await expect(
      waitForRedisReady({
        isReady: () => false,
        subscribe: () => () => undefined,
        timeoutMs: 10,
      })
    ).resolves.toBe(false);
  });

  it('classifies connection timeouts as noise', () => {
    expect(isRedisConnectionNoise(new Error('Connection timeout'))).toBe(true);
    expect(
      isRedisConnectionNoise({
        message: 'Connection timeout',
        code: 'ETIMEDOUT',
      })
    ).toBe(true);
    expect(
      isRedisConnectionNoise({ name: 'ConnectionTimeoutError' })
    ).toBe(true);
    expect(isRedisConnectionNoise({ code: 'ECONNRESET' })).toBe(true);
    expect(isRedisConnectionNoise(new Error('WRONGPASS'))).toBe(false);
  });

  it('backs off reconnect then exhausts', () => {
    expect(redisReconnectDelay(0)).toBe(0);
    expect(redisReconnectDelay(5)).toBe(500);
    expect(redisReconnectDelay(19)).toBe(1900);
    expect(redisReconnectDelay(20)).toBeInstanceOf(Error);
  });
});
