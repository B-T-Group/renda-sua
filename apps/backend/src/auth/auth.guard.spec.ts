import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { AuthGuard } from './auth.guard';
import { IS_PUBLIC_KEY } from './public.decorator';
import { REQUEST_CONTEXT_CLS_KEY } from './request-context';

describe('AuthGuard CLS refresh on public routes', () => {
  let guard: AuthGuard;
  let clsStore: Map<string, unknown>;
  let reflector: Reflector;

  beforeEach(() => {
    clsStore = new Map();
    const cls = {
      get: (key: string) => clsStore.get(key),
      set: (key: string, value: unknown) => clsStore.set(key, value),
    } as unknown as ClsService;

    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as unknown as Reflector;

    const configService = {
      get: () => ({ domain: 'example.auth0.com', audience: 'api' }),
    } as unknown as ConfigService;

    guard = new AuthGuard(configService, reflector, cls);
    jest.spyOn(guard as any, 'verifyToken').mockRejectedValue(new Error('jwt expired'));
  });

  it('resets CLS to anonymous after stripping an invalid token on a public route', async () => {
    const fakeJwt =
      'eyJhbGciOiJSUzI1NiJ9.' +
      Buffer.from(
        JSON.stringify({
          'https://hasura.io/jwt/claims': {
            'x-hasura-user-id': 'leaked-user-id',
          },
        })
      ).toString('base64') +
      '.sig';

    clsStore.set(REQUEST_CONTEXT_CLS_KEY, {
      userId: 'leaked-user-id',
      authToken: fakeJwt,
      activePersona: 'client',
    });

    const request = {
      headers: { authorization: `Bearer ${fakeJwt}` },
      user: undefined,
    };

    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    expect(reflector.getAllAndOverride).toBeDefined();
    expect(IS_PUBLIC_KEY).toBe('isPublic');

    const allowed = await guard.canActivate(context);
    expect(allowed).toBe(true);
    expect(request.headers.authorization).toBeUndefined();
    expect(request.user).toBeUndefined();

    const refreshed = clsStore.get(REQUEST_CONTEXT_CLS_KEY) as {
      userId: string;
      authToken: string | null;
    };
    expect(refreshed.userId).toBe('anonymous');
    expect(refreshed.authToken).toBeNull();
  });
});
