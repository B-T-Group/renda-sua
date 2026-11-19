import { DB_CONNECT_TIMEOUT_MS, DB_POOL_MAX, DatabaseService } from '../../database/database.service';

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({ end: jest.fn() })),
}));

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
});
