import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Allocates BC/PRO/FAC/REC/CR numbers via Hasura run_sql against
 * public.next_export_doc_number (Postgres sequences).
 */
@Injectable()
export class ExportDocNumberService {
  constructor(private readonly configService: ConfigService) {}

  async next(prefix: 'BC' | 'PRO' | 'FAC' | 'REC' | 'CR', country?: string) {
    const countryArg = (country ?? 'XX').replace(/'/g, '');
    const sql =
      prefix === 'BC'
        ? `SELECT public.next_export_doc_number('BC', '${countryArg}') AS n;`
        : `SELECT public.next_export_doc_number('${prefix}', NULL) AS n;`;
    const rows = await this.runSql(sql);
    const value = rows?.[0]?.[0];
    if (!value || typeof value !== 'string') {
      throw new Error(`Failed to allocate ${prefix} document number`);
    }
    return value;
  }

  private async runSql(sql: string): Promise<string[][] | null> {
    const hasura = this.configService.get('hasura') as {
      endpoint?: string;
      adminSecret?: string;
    };
    const endpoint = (hasura?.endpoint || 'http://localhost:8080/v1/graphql')
      .replace(/\/v1\/graphql\/?$/, '')
      .replace(/\/$/, '');
    const res = await fetch(`${endpoint}/v2/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hasura-admin-secret':
          hasura?.adminSecret || 'myadminsecretkey',
      },
      body: JSON.stringify({
        type: 'run_sql',
        args: { source: 'Rendasua', sql, cascade: false, read_only: false },
      }),
    });
    if (!res.ok) {
      throw new Error(`Hasura run_sql failed: ${res.status}`);
    }
    const body = (await res.json()) as {
      result_type?: string;
      result?: string[][];
    };
    if (!body.result || body.result.length < 2) return null;
    return body.result.slice(1);
  }
}
