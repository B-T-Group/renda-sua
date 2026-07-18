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
        activePersona: 'client',
      })
    );

    const ctx = emptyRequestContext({
      userId: 'explicit-user',
      authToken: 'explicit-token',
      activePersona: 'agent',
    });

    expect(service.getUserId(ctx)).toBe('explicit-user');
    expect(service.getActivePersonaHeader(ctx)).toBe('agent');
    expect(service.isConfigured(ctx)).toBe(true);
  });

  it('falls back to CLS when ctx is omitted', () => {
    const { service, clsStore } = makeService();
    clsStore.set(
      REQUEST_CONTEXT_CLS_KEY,
      emptyRequestContext({
        userId: 'cls-user',
        authToken: 'cls-token',
        activePersona: 'business',
      })
    );

    expect(service.getUserId()).toBe('cls-user');
    expect(service.getActivePersonaHeader()).toBe('business');
    expect(service.user_id).toBe('cls-user');
    expect(service.isConfigured()).toBe(true);
  });

  it('returns anonymous when neither ctx nor CLS is set', () => {
    const { service } = makeService();
    expect(service.getUserId()).toBe('anonymous');
    expect(service.isConfigured()).toBe(false);
    expect(service.getActivePersonaHeader()).toBeUndefined();
  });
});
