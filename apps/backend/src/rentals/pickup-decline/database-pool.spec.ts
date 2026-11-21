import { EventEmitter } from 'events';
import { Logger } from '@nestjs/common';
import { DB_CONNECT_TIMEOUT_MS, DB_POOL_MAX, DatabaseService } from '../../database/database.service';

jest.mock('pg', () => {
  const { EventEmitter } = require('events');
  return {
    Pool: jest.fn().mockImplementation(() => {
      const pool = new EventEmitter();
      pool.end = jest.fn(async () => undefined);
      return pool;
    }),
  };
});

type FakeClient = EventEmitter & {
  query: jest.Mock;
  release: jest.Mock;
};

describe('shared Postgres pool', () => {
  it('logs an idle client error instead of crashing', async () => {
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { Pool } = jest.requireMock('pg') as { Pool: jest.Mock };
    Pool.mockClear();
    const service = new DatabaseService({
      get: () => 'postgresql://user:pass@db.example/rendasua',
    } as never);
    try {
      service.onModuleInit();
      const pool = Pool.mock.results[0]?.value as EventEmitter;
      const failure = new Error('Connection terminated unexpectedly');
      expect(() => pool.emit('error', failure, {})).not.toThrow();
      expect(logged).toHaveBeenCalledWith('Postgres idle client error: Connection terminated unexpectedly');
    } finally {
      logged.mockRestore();
      await service.onModuleDestroy();
    }
  });

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

  it('keeps the query error when the connection is dead and rollback fails', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const client = fakeClient(async (text: string) => {
      if (text === 'SELECT boom') {
        client.emit('error', new Error('Connection terminated unexpectedly'));
        throw new Error('canceling statement due to lock timeout');
      }
      if (text === 'ROLLBACK') throw 'socket hang up';
      return { rows: [] };
    });
    const service = serviceOn(client);
    try {
      await expect(service.transaction(async (query) => query('SELECT boom'))).rejects.toThrow(
        'canceling statement due to lock timeout'
      );
      expect(client.query).not.toHaveBeenCalledWith('COMMIT');
      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
      expect(client.release).toHaveBeenCalledTimes(1);
      expect(client.listenerCount('error')).toBe(0);
      expect(warn).toHaveBeenCalledWith('Postgres rollback failed: socket hang up');
    } finally {
      warn.mockRestore();
      await service.onModuleDestroy();
    }
  });

  it('rejects with the commit error when the drop survives a failed rollback', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const client = fakeClient(async (text: string) => {
      if (text === 'COMMIT') {
        client.emit('error', new Error('terminating connection due to idle-in-transaction timeout'));
        throw new Error('Connection terminated unexpectedly');
      }
      if (text === 'ROLLBACK') throw new Error('connection closed');
      return { rows: [{ ok: true }] };
    });
    const service = serviceOn(client);
    try {
      await expect(service.transaction(async (query) => query('SELECT 1'))).rejects.toThrow(
        'Connection terminated unexpectedly'
      );
      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
      expect(client.release).toHaveBeenCalledTimes(1);
      expect(client.listenerCount('error')).toBe(0);
      expect(warn).toHaveBeenCalledWith('Postgres rollback failed: connection closed');
    } finally {
      warn.mockRestore();
      await service.onModuleDestroy();
    }
  });

  it('removes the error listener before the client returns to the pool', async () => {
    const client = fakeClient();
    const service = serviceOn(client);
    await service.transaction(async (query) => {
      expect(client.listenerCount('error')).toBe(1);
      return query('SELECT 1');
    });
    expect(client.listenerCount('error')).toBe(0);
    await service.transaction(async () => {
      expect(client.listenerCount('error')).toBe(1);
      return 'second';
    });
    expect(client.listenerCount('error')).toBe(0);
    expect(client.release).toHaveBeenCalledTimes(2);
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
  Pool.mockImplementation(() => {
    const pool = new EventEmitter();
    return Object.assign(pool, {
      connect: async () => client,
      end: async () => undefined,
    });
  });
  const service = new DatabaseService({
    get: () => 'postgresql://user:pass@db.example/rendasua',
  } as never);
  service.onModuleInit();
  return service;
}
