import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type QueryResultRow } from 'pg';

export type DatabaseQuery = <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) => Promise<T[]>;

/** Shared with commerce jobs on one RDS instance. Declines must not hold a client during provider HTTP. */
export const DB_POOL_MAX = 8;
export const DB_CONNECT_TIMEOUT_MS = 5_000;

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const url = this.configService.get<string>('database.url');
    if (!url?.trim()) {
      this.logger.warn('database.url not configured; Postgres queries disabled');
      return;
    }
    this.pool = new Pool({
      connectionString: url,
      max: DB_POOL_MAX,
      connectionTimeoutMillis: DB_CONNECT_TIMEOUT_MS,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<T[]> {
    const pool = this.requirePool();
    const result = await pool.query<T>(text, params);
    return result.rows;
  }

  async transaction<T>(fn: (query: DatabaseQuery) => Promise<T>): Promise<T> {
    const client = await this.requirePool().connect();
    try {
      await client.query('BEGIN');
      const result = await fn(async (text, params) => {
        const res = await client.query(text, params);
        return res.rows;
      });
      await client.query('COMMIT');
      return result;
    } catch (error: any) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private requirePool(): Pool {
    if (!this.pool) {
      throw new Error('Postgres pool is not configured (set DATABASE_URL)');
    }
    return this.pool;
  }
}
