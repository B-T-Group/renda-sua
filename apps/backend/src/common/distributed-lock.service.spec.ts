import { DistributedLockService } from './distributed-lock.service';

function build() {
  return new DistributedLockService({ get: () => undefined } as never);
}

describe('DistributedLockService (in-process fallback, no Redis configured)', () => {
  it('lets only one caller hold a key until released', async () => {
    const locks = build();
    const first = await locks.tryAcquire('k', 1000);
    expect(first).not.toBeNull();
    expect(await locks.tryAcquire('k', 1000)).toBeNull();
    expect(await locks.tryAcquire('other', 1000)).not.toBeNull();

    await first!();
    expect(await locks.tryAcquire('k', 1000)).not.toBeNull();
  });

  it('expires a stale lock after its ttl', async () => {
    const locks = build();
    await locks.tryAcquire('k', 20);
    await new Promise((r) => setTimeout(r, 40));
    expect(await locks.tryAcquire('k', 1000)).not.toBeNull();
  });

  it('a late release from an expired holder does not free the new holder', async () => {
    const locks = build();
    const stale = await locks.tryAcquire('k', 10);
    await new Promise((r) => setTimeout(r, 25));
    const fresh = await locks.tryAcquire('k', 1000);
    await stale!();
    expect(await locks.tryAcquire('k', 1000)).toBeNull();
    await fresh!();
  });

  it('acquire waits for the holder, and gives up after waitMs', async () => {
    const locks = build();
    const first = await locks.tryAcquire('k', 1000);
    setTimeout(() => void first!(), 80);
    expect(await locks.acquire('k', 1000, 1000)).not.toBeNull();

    expect(await locks.acquire('k', 1000, 100)).toBeNull();
  });

  it('requireShared skips instead of falling back when Redis is unavailable', async () => {
    const locks = build();
    expect(await locks.tryAcquire('k', 1000, { requireShared: true })).toBeNull();
  });
});

describe('DistributedLockService (Redis)', () => {
  function withRedis(set: jest.Mock, evalFn: jest.Mock) {
    const locks = new DistributedLockService({
      get: () => ({ host: 'h', port: 1 }),
    } as never);
    (locks as any).client = { isReady: true, set, eval: evalFn };
    return locks;
  }

  it('uses SET NX PX and releases only with its own token', async () => {
    const set = jest.fn().mockResolvedValueOnce('OK').mockResolvedValueOnce(null);
    const evalFn = jest.fn().mockResolvedValue(1);
    const locks = withRedis(set, evalFn);

    const release = await locks.tryAcquire('cron:x', 5000, { requireShared: true });
    expect(set).toHaveBeenCalledWith('lock:cron:x', expect.any(String), { NX: true, PX: 5000 });
    expect(await locks.tryAcquire('cron:x', 5000, { requireShared: true })).toBeNull();

    await release!();
    const token = set.mock.calls[0][1];
    expect(evalFn).toHaveBeenCalledWith(expect.stringContaining('del'), {
      keys: ['lock:cron:x'],
      arguments: [token],
    });
  });

  it('with requireShared a Redis error skips; without it falls back locally', async () => {
    const set = jest.fn().mockRejectedValue(new Error('boom'));
    const locks = withRedis(set, jest.fn());
    expect(await locks.tryAcquire('a', 1000, { requireShared: true })).toBeNull();
    expect(await locks.tryAcquire('a', 1000)).not.toBeNull();
  });
});
