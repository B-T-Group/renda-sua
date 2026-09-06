import {
  connectRedisWithRetry,
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
});
