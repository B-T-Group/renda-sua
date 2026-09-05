import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import {
  REQUEST_CONTEXT_CLS_KEY,
  emptyRequestContext,
} from '../auth/request-context';
import { HasuraSystemService } from './hasura-system.service';
import { HasuraUserService } from './hasura-user.service';

const VALID_USER_ID = '11111111-1111-4111-8111-111111111111';
const CLS_USER_ID = '22222222-2222-4222-8222-222222222222';
const AUTH0_EMAIL_SUB = 'email|6a95505255ad3b18af9e159f';
const AUTH0_PHONE_SUB = 'auth0|test-phone|+24174000000';

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
        userId: CLS_USER_ID,
        authToken: 'cls-token',
        jwtDefaultRole: 'client',
        jwtAllowedRoles: ['client'],
      })
    );

    const ctx = emptyRequestContext({
      userId: VALID_USER_ID,
      authToken: 'explicit-token',
      jwtDefaultRole: 'agent',
      jwtAllowedRoles: ['agent', 'client'],
    });

    expect(service.getUserId(ctx)).toBe(VALID_USER_ID);
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
        userId: CLS_USER_ID,
        authToken: 'cls-token',
        jwtDefaultRole: 'business',
        jwtAllowedRoles: ['business'],
      })
    );

    expect(service.getUserId()).toBe(CLS_USER_ID);
    expect(service.sessionPersonaContext()).toEqual({
      jwtDefaultRole: 'business',
      jwtAllowedRoles: ['business'],
      activePersona: undefined,
    });
    expect(service.user_id).toBe(CLS_USER_ID);
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

  it('getUserId rejects Auth0 email and phone JWT user ids', () => {
    const { service } = makeService();

    expect(() =>
      service.getUserId(emptyRequestContext({ userId: AUTH0_EMAIL_SUB }))
    ).toThrow(UnauthorizedException);
    expect(() =>
      service.getUserId(emptyRequestContext({ userId: AUTH0_PHONE_SUB }))
    ).toThrow(UnauthorizedException);
    expect(() =>
      service.getUserId(emptyRequestContext({ userId: VALID_USER_ID }))
    ).not.toThrow();
  });

  it('getUser rejects Auth0-style JWT user ids before querying Hasura', async () => {
    const { service, hasuraSystem } = makeService();
    const ctx = emptyRequestContext({
      userId: AUTH0_EMAIL_SUB,
      authToken: 'token',
    });

    await expect(service.getUser(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
    expect(hasuraSystem.getUserByIdWithRelations).not.toHaveBeenCalled();
  });

  it('getUserIdentity rejects Auth0-style JWT user ids before querying Hasura', async () => {
    const { service, hasuraSystem } = makeService();
    const ctx = emptyRequestContext({
      userId: AUTH0_EMAIL_SUB,
      authToken: 'token',
    });

    await expect(service.getUserIdentity(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
    expect(hasuraSystem.getUserByIdWithRelations).not.toHaveBeenCalled();
  });

  it('getUser loads the user when JWT user id is a UUID', async () => {
    const { service, hasuraSystem } = makeService();
    (hasuraSystem.getUserByIdWithRelations as jest.Mock).mockResolvedValue({
      id: VALID_USER_ID,
      client: { id: 'c1' },
      agent: null,
      business: null,
    });
    const ctx = emptyRequestContext({
      userId: VALID_USER_ID,
      authToken: 'token',
      jwtDefaultRole: 'client',
      jwtAllowedRoles: ['client'],
    });

    const user = await service.getUser(ctx);

    expect(user.id).toBe(VALID_USER_ID);
    expect(hasuraSystem.getUserByIdWithRelations).toHaveBeenCalledWith(
      VALID_USER_ID
    );
  });

  it('maps transient Hasura network errors in getUser to 503', async () => {
    const { service, clsStore, hasuraSystem } = makeService();
    clsStore.set(
      REQUEST_CONTEXT_CLS_KEY,
      emptyRequestContext({
        userId: VALID_USER_ID,
        authToken: 'token',
      })
    );
    (hasuraSystem.getUserByIdWithRelations as jest.Mock).mockRejectedValue({
      message:
        'GraphQL Error (Code: 503): {"response":{"error":"<html><title>503 Service Temporarily Unavailable</title></html>","status":503}}',
      response: {
        error: '<html><title>503 Service Temporarily Unavailable</title></html>',
        status: 503,
      },
    });

    await expect(service.getUser()).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
  });

  it('maps nginx HTML 404s in getUser to 503', async () => {
    const { service, clsStore, hasuraSystem } = makeService();
    clsStore.set(
      REQUEST_CONTEXT_CLS_KEY,
      emptyRequestContext({
        userId: VALID_USER_ID,
        authToken: 'token',
      })
    );
    (hasuraSystem.getUserByIdWithRelations as jest.Mock).mockRejectedValue({
      message:
        'GraphQL Error (Code: 404): {"response":{"error":"<html><title>404 Not Found</title></html>","status":404}}',
      response: {
        error: '<html><title>404 Not Found</title></html>',
        status: 404,
      },
    });

    await expect(service.getUser()).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
  });

  it('rethrows user-not-found from getUser', async () => {
    const { service, clsStore, hasuraSystem } = makeService();
    clsStore.set(
      REQUEST_CONTEXT_CLS_KEY,
      emptyRequestContext({
        userId: VALID_USER_ID,
        authToken: 'token',
      })
    );
    const missing = new Error(
      `User not found for id: ${VALID_USER_ID}`
    );
    (hasuraSystem.getUserByIdWithRelations as jest.Mock).mockRejectedValue(
      missing
    );

    await expect(service.getUser()).rejects.toBe(missing);
  });

  it('preserves HttpException from getUser', async () => {
    const { service, clsStore, hasuraSystem } = makeService();
    clsStore.set(
      REQUEST_CONTEXT_CLS_KEY,
      emptyRequestContext({
        userId: VALID_USER_ID,
        authToken: 'token',
      })
    );
    const forbidden = new HttpException(
      { success: false, error: 'Account has been deleted' },
      HttpStatus.FORBIDDEN
    );
    (hasuraSystem.getUserByIdWithRelations as jest.Mock).mockRejectedValue(
      forbidden
    );

    await expect(service.getUser()).rejects.toBe(forbidden);
  });
});
