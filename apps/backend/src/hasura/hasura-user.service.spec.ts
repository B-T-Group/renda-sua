import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import {
  REQUEST_CONTEXT_CLS_KEY,
  emptyRequestContext,
} from '../auth/request-context';
import { HasuraSystemService } from './hasura-system.service';
import { HasuraUserService } from './hasura-user.service';

function makeService(clsStore: Map<string, unknown> = new Map()) {
  const cls = {
    get: (key: string) => clsStore.get(key),
    set: (key: string, value: unknown) => clsStore.set(key, value),
  } as unknown as ClsService;

  const configService = {
    get: () => ({ endpoint: 'http://localhost:8080/v1/graphql' }),
  } as unknown as ConfigService;

  const hasuraSystem = {
    getUserByIdWithRelations: jest.fn(),
    getAllUserAddresses: jest.fn().mockResolvedValue([]),
    getUserAgent: jest.fn(),
  } as unknown as HasuraSystemService;

  const service = new HasuraUserService(configService, hasuraSystem, cls);
  return { service, clsStore, hasuraSystem };
}

describe('HasuraUserService (singleton + CLS)', () => {
  it('uses explicit RequestContext over CLS', () => {
    const { service, clsStore } = makeService();
    clsStore.set(
      REQUEST_CONTEXT_CLS_KEY,
      emptyRequestContext({
        userId: 'cls-user',
        authToken: 'cls-token',
        jwtDefaultRole: 'client',
        jwtAllowedRoles: ['client'],
      })
    );

    const ctx = emptyRequestContext({
      userId: 'explicit-user',
      authToken: 'explicit-token',
      jwtDefaultRole: 'agent',
      jwtAllowedRoles: ['agent', 'client'],
    });

    expect(service.getUserId(ctx)).toBe('explicit-user');
    expect(service.sessionPersonaContext(ctx)).toEqual({
      jwtDefaultRole: 'agent',
      jwtAllowedRoles: ['agent', 'client'],
      activePersona: undefined,
    });
    expect(service.isConfigured(ctx)).toBe(true);
  });

  it('falls back to CLS when ctx is omitted', () => {
    const { service, clsStore } = makeService();
    clsStore.set(
      REQUEST_CONTEXT_CLS_KEY,
      emptyRequestContext({
        userId: 'cls-user',
        authToken: 'cls-token',
        jwtDefaultRole: 'business',
        jwtAllowedRoles: ['business'],
      })
    );

    expect(service.getUserId()).toBe('cls-user');
    expect(service.sessionPersonaContext()).toEqual({
      jwtDefaultRole: 'business',
      jwtAllowedRoles: ['business'],
      activePersona: undefined,
    });
    expect(service.user_id).toBe('cls-user');
    expect(service.isConfigured()).toBe(true);
  });

  it('returns anonymous when neither ctx nor CLS is set', () => {
    const { service } = makeService();
    expect(service.getUserId()).toBe('anonymous');
    expect(service.isConfigured()).toBe(false);
    expect(service.sessionPersonaContext()).toEqual({
      jwtDefaultRole: undefined,
      jwtAllowedRoles: undefined,
      activePersona: undefined,
    });
  });

  it('getSessionPersona validates JWT role against user profiles', () => {
    const { service } = makeService();
    const ctx = emptyRequestContext({
      jwtDefaultRole: 'agent',
      jwtAllowedRoles: ['agent', 'client'],
    });
    expect(
      service.getSessionPersona(
        { agent: { id: 'a1' }, client: { id: 'c1' } },
        ctx
      )
    ).toBe('agent');
  });

  it('forwards X-Hasura-Role from X-Active-Persona when JWT allows it', () => {
    const { service } = makeService();
    const ctx = emptyRequestContext({
      userId: 'u1',
      authToken: 'token',
      jwtDefaultRole: 'client',
      jwtAllowedRoles: ['client', 'business'],
      activePersona: 'business',
    });
    const client = service.createGraphQLClient(ctx);
    expect(client.requestConfig.headers).toMatchObject({
      Authorization: 'Bearer token',
      'X-Hasura-Role': 'business',
    });
  });

  it('falls back to JWT default role when active persona is not allowed', () => {
    const { service } = makeService();
    const ctx = emptyRequestContext({
      userId: 'u1',
      authToken: 'token',
      jwtDefaultRole: 'client',
      jwtAllowedRoles: ['client'],
      activePersona: 'business',
    });
    expect(service.hasuraRoleForRequest(ctx)).toBe('client');
    const client = service.createGraphQLClient(ctx);
    expect(client.requestConfig.headers).toMatchObject({
      'X-Hasura-Role': 'client',
    });
  });

  it('maps transient Hasura 503 errors in getUser to 503', async () => {
    const { service, clsStore, hasuraSystem } = makeService();
    clsStore.set(
      REQUEST_CONTEXT_CLS_KEY,
      emptyRequestContext({
        userId: '11111111-1111-1111-1111-111111111111',
        authToken: 'token',
      })
    );
    (hasuraSystem.getUserByIdWithRelations as jest.Mock).mockRejectedValue(
      Object.assign(
        new Error(
          'GraphQL Error (Code: 503): {"response":{"error":"<html>503 Service Temporarily Unavailable</html>"}}'
        ),
        { response: { status: 503 } }
      )
    );

    await expect(service.getUser()).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
  });

  it('rethrows user-not-found from getUser', async () => {
    const { service, clsStore, hasuraSystem } = makeService();
    const missing = new Error(
      'User not found for id: 11111111-1111-1111-1111-111111111111'
    );
    clsStore.set(
      REQUEST_CONTEXT_CLS_KEY,
      emptyRequestContext({
        userId: '11111111-1111-1111-1111-111111111111',
        authToken: 'token',
      })
    );
    (hasuraSystem.getUserByIdWithRelations as jest.Mock).mockRejectedValue(
      missing
    );

    await expect(service.getUser()).rejects.toBe(missing);
  });

  it('preserves HttpException from getUser', async () => {
    const { service, clsStore, hasuraSystem } = makeService();
    const forbidden = new HttpException(
      { success: false, error: 'Account has been deleted' },
      HttpStatus.FORBIDDEN
    );
    clsStore.set(
      REQUEST_CONTEXT_CLS_KEY,
      emptyRequestContext({
        userId: '11111111-1111-1111-1111-111111111111',
        authToken: 'token',
      })
    );
    (hasuraSystem.getUserByIdWithRelations as jest.Mock).mockRejectedValue(
      forbidden
    );

    await expect(service.getUser()).rejects.toBe(forbidden);
  });
});
