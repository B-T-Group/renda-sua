import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const MIGRATIONS = join(__dirname, '../../../hasura/migrations/Rendasua');
const ENUM_DIR = join(MIGRATIONS, '20261031160000_client_confirm_delivery');
const SCHEMA_DIR = join(MIGRATIONS, '20261031161000_client_confirm_delivery_schema');

const enumUp = readFileSync(join(ENUM_DIR, 'up.sql'), 'utf8');
const schemaUp = readFileSync(join(SCHEMA_DIR, 'up.sql'), 'utf8');
const schemaDown = readFileSync(join(SCHEMA_DIR, 'down.sql'), 'utf8');

const ENUM_VALUES = [
  'awaiting_client_confirmation',
  'pending_auto_complete',
  'disputed',
] as const;

const stripSqlComments = (sql: string): string =>
  sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

describe('client-confirm delivery Hasura migrations (PG 55P04 split)', () => {
  it('keeps ADD VALUE in 20261031160000 and uses the values only in a later version', () => {
    const versions = readdirSync(MIGRATIONS, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^\d+_/.test(entry.name))
      .map((entry) => entry.name)
      .sort();

    expect(versions.indexOf('20261031160000_client_confirm_delivery')).toBeGreaterThan(-1);
    expect(versions.indexOf('20261031161000_client_confirm_delivery_schema')).toBeGreaterThan(
      versions.indexOf('20261031160000_client_confirm_delivery')
    );
  });

  it('20261031160000 only adds the three order_status values (IF NOT EXISTS)', () => {
    const body = stripSqlComments(enumUp);
    for (const value of ENUM_VALUES) {
      expect(enumUp).toContain(
        `ALTER TYPE order_status ADD VALUE IF NOT EXISTS '${value}'`
      );
    }
    expect(body).not.toMatch(/ALTER TABLE|CREATE INDEX|CREATE TABLE|INSERT INTO/i);
    expect(body).not.toMatch(/current_status\s*=/);
  });

  it('20261031161000 is idempotent schema and does not ADD VALUE', () => {
    expect(schemaUp).not.toMatch(/ALTER TYPE/i);
    expect(schemaUp).toMatch(/ADD COLUMN IF NOT EXISTS delivery_confirmation_method/);
    expect(schemaUp).toMatch(/CREATE INDEX IF NOT EXISTS orders_pending_auto_complete_deadline_idx/);
    expect(schemaUp).toMatch(/WHERE current_status = 'pending_auto_complete'/);
    expect(schemaUp).toMatch(/CREATE INDEX IF NOT EXISTS orders_awaiting_client_confirmation_idx/);
    expect(schemaUp).toMatch(/WHERE current_status = 'awaiting_client_confirmation'/);
    expect(schemaUp).toMatch(/CREATE TABLE IF NOT EXISTS public\.order_delivery_proof_photos/);
    expect(schemaUp).toContain('client_confirm_auto_complete_hours');
    expect(schemaUp).toContain('WHERE NOT EXISTS');
    expect(schemaDown).toMatch(/DROP TABLE IF EXISTS public\.order_delivery_proof_photos/);
    expect(schemaDown).toMatch(/DROP COLUMN IF EXISTS delivery_confirmation_method/);
  });
});
