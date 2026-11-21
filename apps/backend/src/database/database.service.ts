import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';

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
    // pg-pool emits this for an idle client and then removes it. No listener exits the process.
    this.pool.on('error', (error: Error) => this.noteIdleClientError(error));
  }

  private noteIdleClientError(error: Error): void {
    this.logger.error(`Postgres idle client error: ${error?.message ?? error}`);
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
    const detach = this.holdClientErrors(client);
    try {
      return await this.commitWork(client, fn);
    } catch (error: any) {
      await this.rollbackQuiet(client);
      throw error;
    } finally {
      detach();
      client.release();
    }
  }

  /** A checked-out client has no pool listener. An `error` event would crash the process. */
  private holdClientErrors(client: PoolClient): () => void {
    const onError = (error: Error) => {
      this.logger.error(`Postgres client error during transaction: ${error.message}`);
    };
    client.on('error', onError);
    return () => client.removeListener('error', onError);
  }

  private async commitWork<T>(
    client: PoolClient,
    fn: (query: DatabaseQuery) => Promise<T>
  ): Promise<T> {
    await client.query('BEGIN');
    const result = await fn((text, params) => this.clientRows(client, text, params));
    await client.query('COMMIT');
    return result;
  }

  private async clientRows<T extends QueryResultRow>(
    client: PoolClient,
    text: string,
    params?: unknown[]
  ): Promise<T[]> {
    const res = await client.query<T>(text, params);
    return res.rows;
  }

  private async rollbackQuiet(client: PoolClient): Promise<void> {
    try {
      await client.query('ROLLBACK');
    } catch (error: any) {
      this.logger.warn(`Postgres rollback failed: ${error?.message ?? error}`);
    }
  }

  private requirePool(): Pool {
    if (!this.pool) {
      throw new Error('Postgres pool is not configured (set DATABASE_URL)');
    }
    return this.pool;
  }
}
