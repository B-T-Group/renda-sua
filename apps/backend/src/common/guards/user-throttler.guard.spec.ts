import { UserThrottlerGuard } from './user-throttler.guard';

describe('UserThrottlerGuard tracker', () => {
  function trackerFor(clsValue: unknown, req: Record<string, any>) {
    const guard = new UserThrottlerGuard(
      {} as never,
      {} as never,
      {} as never,
      { get: jest.fn().mockReturnValue(clsValue) } as never
    );
    return (guard as any).getTracker(req);
  }

  it('tracks authenticated users by user id', async () => {
    await expect(
      trackerFor({ userId: 'user-42' }, { ip: '8.8.8.8' })
    ).resolves.toBe('user-user-42');
  });

  it('falls back to the first forwarded IP for anonymous callers', async () => {
    await expect(
      trackerFor({ userId: 'anonymous' }, { ip: '1.1.1.1', ips: ['9.9.9.9'] })
    ).resolves.toBe('ip-9.9.9.9');
    await expect(trackerFor(undefined, { ip: '2.2.2.2' })).resolves.toBe(
      'ip-2.2.2.2'
    );
  });
});
