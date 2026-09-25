jest.mock('redis', () => ({
  createClient: jest.fn(),
}));

import { AuthFlowV2StoreService } from './auth-flow-v2-store.service';

const record = {
  userId: 'user-1',
  channel: 'email' as const,
  email: 'shop@example.com',
  phone: '',
};

function createStore(): AuthFlowV2StoreService {
  return new AuthFlowV2StoreService({
    get: jest.fn().mockReturnValue(undefined),
  } as never);
}

describe('AuthFlowV2StoreService (in-memory)', () => {
  const stores: AuthFlowV2StoreService[] = [];

  afterEach(async () => {
    jest.restoreAllMocks();
    await Promise.all(stores.splice(0).map((store) => store.onModuleDestroy()));
  });

  function track(store: AuthFlowV2StoreService) {
    stores.push(store);
    return store;
  }

  it('round-trips a login flow and isolates flow ids', async () => {
    const store = track(createStore());
    await store.save('flow-a', record);
    await store.save('flow-b', { ...record, userId: 'user-2', channel: 'sms' });

    await expect(store.get('flow-a')).resolves.toEqual(record);
    await expect(store.get('flow-b')).resolves.toEqual({
      ...record,
      userId: 'user-2',
      channel: 'sms',
    });
    await expect(store.get('missing')).resolves.toBeNull();
  });

  it('drops an expired flow and does not return it again', async () => {
    const store = track(createStore());
    const now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    await store.save('flow-a', record, 60);
    const memory = (
      store as unknown as {
        inMemory: Map<string, { json: string; expiresAt: number }>;
      }
    ).inMemory;
    const entry = memory.get('auth:flow:v2:flow-a');
    expect(entry?.expiresAt).toBe(now + 60_000);

    jest.spyOn(Date, 'now').mockReturnValue(entry!.expiresAt);
    await expect(store.get('flow-a')).resolves.toBeNull();
    expect(memory.has('auth:flow:v2:flow-a')).toBe(false);
  });

  it('returns null for corrupt JSON and forgets a deleted flow', async () => {
    const store = track(createStore());
    await store.save('flow-a', record);
    const memory = (
      store as unknown as {
        inMemory: Map<string, { json: string; expiresAt: number }>;
      }
    ).inMemory;
    const entry = memory.get('auth:flow:v2:flow-a');
    entry!.json = '{';
    await expect(store.get('flow-a')).resolves.toBeNull();

    entry!.json = JSON.stringify(record);
    await store.delete('flow-a');
    await expect(store.get('flow-a')).resolves.toBeNull();
  });
});
