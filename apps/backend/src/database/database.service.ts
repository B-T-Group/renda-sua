import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type QueryResultRow } from 'pg';

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
    this.pool = new Pool({ connectionString: url });
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

  private requirePool(): Pool {
    if (!this.pool) {
      throw new Error('Postgres pool is not configured (set DATABASE_URL)');
    }
    return this.pool;
  }
}
