import { EventEmitter } from 'events';
import { DB_CONNECT_TIMEOUT_MS, DB_POOL_MAX, DatabaseService } from '../../database/database.service';

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({ end: jest.fn() })),
}));

type FakeClient = EventEmitter & {
  query: jest.Mock;
  release: jest.Mock;
};

describe('shared Postgres pool', () => {
  it('caps the pool and times out a connect', async () => {
    const { Pool } = jest.requireMock('pg') as { Pool: jest.Mock };
    Pool.mockClear();
    const service = new DatabaseService({
      get: () => 'postgresql://user:pass@db.example/rendasua',
    } as never);
    service.onModuleInit();
    expect(Pool).toHaveBeenCalledWith({
      connectionString: 'postgresql://user:pass@db.example/rendasua',
      max: DB_POOL_MAX,
      connectionTimeoutMillis: DB_CONNECT_TIMEOUT_MS,
    });
    expect(DB_POOL_MAX).toBe(8);
    expect(DB_CONNECT_TIMEOUT_MS).toBe(5_000);
    await service.onModuleDestroy();
  });

  it('handles a client error during a transaction instead of crashing', async () => {
    const client = fakeClient();
    const service = serviceOn(client);
    const result = await service.transaction(async (query) => {
      client.emit('error', new Error('terminating connection due to idle-in-transaction timeout'));
      return query('SELECT 1');
    });
    expect(result).toEqual([{ ok: true }]);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
    await service.onModuleDestroy();
  });

  it('rolls back and keeps the original error when the query fails', async () => {
    const client = fakeClient(async (text: string) => {
      if (text === 'SELECT boom') throw new Error('boom');
      return { rows: [] };
    });
    const service = serviceOn(client);
    await expect(service.transaction(async (query) => query('SELECT boom'))).rejects.toThrow('boom');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
    await service.onModuleDestroy();
  });
});

function fakeClient(queryImpl?: (text: string) => Promise<{ rows: unknown[] }>): FakeClient {
  const client = new EventEmitter() as FakeClient;
  client.query = jest.fn(queryImpl ?? (async () => ({ rows: [{ ok: true }] })));
  client.release = jest.fn();
  return client;
}

function serviceOn(client: FakeClient): DatabaseService {
  const { Pool } = jest.requireMock('pg') as { Pool: jest.Mock };
  Pool.mockImplementation(() => ({
    connect: async () => client,
    end: async () => undefined,
  }));
  const service = new DatabaseService({
    get: () => 'postgresql://user:pass@db.example/rendasua',
  } as never);
  service.onModuleInit();
  return service;
}
