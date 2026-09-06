jest.mock('redis', () => ({
  createClient: jest.fn(),
}));

import { createClient } from 'redis';
import { SessionStoreService, SessionData } from './session-store.service';

const createClientMock = createClient as jest.Mock;

function redisAbortError(): Error {
  const error = new Error();
  error.stack = [
    'Error',
    '    at AbortSignal.? (node_modules/redis/node_modules/@redis/client/lib/client/commands-queue.ts:298:13)',
  ].join('\n');
  return error;
}

function createRedisApi() {
  return {
    isReady: true,
    isOpen: true,
    get: jest.fn().mockResolvedValue(null),
    setEx: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    sAdd: jest.fn().mockResolvedValue(1),
    sRem: jest.fn().mockResolvedValue(1),
    sMembers: jest.fn().mockResolvedValue([]),
    expire: jest.fn().mockResolvedValue(1),
    multi: jest.fn(() => ({
      del: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    })),
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  };
}

function sessionData(overrides: Partial<SessionData> = {}): SessionData {
  return {
    userId: 'user-1',
    auth0RefreshToken: 'refresh',
    auth0AccessToken: 'access',
    createdAt: 1,
    lastRefreshedAt: 1,
    ...overrides,
  };
}

describe('SessionStoreService', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalJwt = process.env.JWT_SECRET;
  const originalSessionKey = process.env.SESSION_ENCRYPTION_KEY;
  const stores: SessionStoreService[] = [];

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    process.env.JWT_SECRET = 'dev-session-secret';
    delete process.env.SESSION_ENCRYPTION_KEY;
  });

  afterEach(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.JWT_SECRET = originalJwt;
    if (originalSessionKey === undefined) {
      delete process.env.SESSION_ENCRYPTION_KEY;
    } else {
      process.env.SESSION_ENCRYPTION_KEY = originalSessionKey;
    }
    await Promise.all(stores.splice(0).map((store) => store.onModuleDestroy()));
    jest.clearAllMocks();
  });

  function memoryStore() {
    const store = new SessionStoreService({
      get: jest.fn(() => undefined),
    } as any);
    stores.push(store);
    return store;
  }

  async function redisStore(redisApi = createRedisApi()) {
    createClientMock.mockReturnValue(redisApi);
    const store = new SessionStoreService({
      get: jest.fn((key: string) =>
        key === 'redis' ? { host: 'localhost', port: 6379 } : undefined
      ),
    } as any);
    stores.push(store);
    await Promise.resolve();
    const pendingConnect = redisApi.connect.mock.results[0]?.value;
    if (pendingConnect) await pendingConnect;
    return { store, redisApi };
  }

  it('requires a 32-byte SESSION_ENCRYPTION_KEY in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SESSION_ENCRYPTION_KEY;
    expect(() => memoryStore()).toThrow(/SESSION_ENCRYPTION_KEY is required/);
  });

  it('round-trips session data through in-memory encryption', async () => {
    const store = memoryStore();
    await store.createSession('sid-1', sessionData({ familyId: 'fam-1' }));
    await expect(store.getSession('sid-1')).resolves.toMatchObject({
      userId: 'user-1',
      familyId: 'fam-1',
    });
  });

  it('returns null and deletes a session that cannot be decrypted', async () => {
    const store = memoryStore();
    (store as any).inMemoryStore.set('sid-bad', 'not:valid:ciphertext');
    await expect(store.getSession('sid-bad')).resolves.toBeNull();
    expect((store as any).inMemoryStore.has('sid-bad')).toBe(false);
  });

  it('deletes an undecryptable Redis session without recursing through getSession', async () => {
    const { store, redisApi } = await redisStore();
    redisApi.get.mockResolvedValue('not:valid:ciphertext');

    await expect(store.getSession('sid-bad')).resolves.toBeNull();

    expect(redisApi.del).toHaveBeenCalledWith('session:sid-bad');
    expect(redisApi.get.mock.calls.length).toBeLessThan(5);
    expect(redisApi.sRem).not.toHaveBeenCalled();
  });

  it('removes a readable Redis session from its family set on delete', async () => {
    const { store, redisApi } = await redisStore();
    await store.createSession('sid-1', sessionData({ familyId: 'fam-1' }));
    const stored = redisApi.setEx.mock.calls[0][2] as string;
    redisApi.get.mockResolvedValue(stored);

    await store.deleteSession('sid-1');

    expect(redisApi.del).toHaveBeenCalledWith('session:sid-1');
    expect(redisApi.sRem).toHaveBeenCalledWith('session-family:fam-1', 'sid-1');
  });

  it('rotates a live session and retires the previous id', async () => {
    const store = memoryStore();
    await store.createSession('sid-old', sessionData({ familyId: 'fam-1' }));

    const newId = await store.rotateSession('sid-old');
    expect(newId).toEqual(expect.any(String));
    expect(newId).not.toBe('sid-old');

    await expect(store.getSession('sid-old')).resolves.toMatchObject({
      retired: true,
      familyId: 'fam-1',
    });
    await expect(store.getSession(newId!)).resolves.toMatchObject({
      userId: 'user-1',
      retired: false,
      familyId: 'fam-1',
    });
  });

  it('treats reuse of a retired session as an attack and wipes the family', async () => {
    const store = memoryStore();
    await store.createSession('sid-old', sessionData({ familyId: 'fam-1' }));
    const newId = await store.rotateSession('sid-old');
    expect(newId).toBeTruthy();

    await expect(store.rotateSession('sid-old')).resolves.toBeNull();
    await expect(store.getSession('sid-old')).resolves.toBeNull();
    await expect(store.getSession(newId!)).resolves.toBeNull();
  });

  it('falls back to memory in development when Redis SET aborts', async () => {
    const { store, redisApi } = await redisStore();
    redisApi.setEx.mockRejectedValue(redisAbortError());
    await store.createSession('sid-1', sessionData());
    await expect(store.getSession('sid-1')).resolves.toMatchObject({
      userId: 'user-1',
    });
  });
});
