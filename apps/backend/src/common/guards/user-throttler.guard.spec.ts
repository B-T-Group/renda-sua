import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../auth/public.decorator';
import { UserThrottlerGuard } from './user-throttler.guard';

describe('UserThrottlerGuard tracker', () => {
  const mockContext = {
    getHandler: () => jest.fn(),
    getClass: () => class MockController {},
  } as unknown as ExecutionContext;

  function trackerFor(isPublic: boolean, req: Record<string, any>) {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) =>
        key === IS_PUBLIC_KEY ? isPublic : undefined
      ),
    } as unknown as Reflector;
    const guard = new UserThrottlerGuard(
      {} as never,
      {} as never,
      reflector
    );
    return (guard as any).resolveTracker(req, mockContext);
  }

  it('tracks @Public() routes by IP even with Bearer', async () => {
    await expect(
      trackerFor(true, {
        ip: '8.8.8.8',
        headers: { authorization: 'Bearer token' },
      })
    ).resolves.toBe('ip-8.8.8.8');
  });

  it('tracks protected routes with req.user by Auth0 sub', async () => {
    await expect(
      trackerFor(false, { ip: '8.8.8.8', user: { sub: 'auth0|42' } })
    ).resolves.toBe('user-auth0|42');
  });

  it('falls back to IP on protected routes without req.user', async () => {
    await expect(trackerFor(false, { ip: '2.2.2.2' })).resolves.toBe(
      'ip-2.2.2.2'
    );
  });
});
