import { readFileSync } from 'fs';
import { join } from 'path';

const DIR = join(
  __dirname,
  '../../../hasura/migrations/Rendasua/20261104150000_mm_delivered_complete'
);
const META = join(__dirname, '../../../hasura/metadata/databases/Rendasua/tables');
const up = readFileSync(join(DIR, 'up.sql'), 'utf8');
const down = readFileSync(join(DIR, 'down.sql'), 'utf8');
const strip = (sql: string) => sql.replace(/--[^\n]*/g, '');

describe('MoMo delivered/complete migration', () => {
  it('adds no enum values (reuses awaiting_client_confirmation)', () => {
    expect(strip(up)).not.toMatch(/ADD VALUE/i);
  });

  it('is idempotent and additive', () => {
    const body = strip(up);
    for (const col of [
      'delivered_at',
      'report_window_ends_at',
      'dispute_type',
      'dispute_reason',
      'dispute_opened_at',
    ]) {
      expect(body).toMatch(new RegExp(`ADD COLUMN IF NOT EXISTS ${col}\\b`));
    }
    expect(body).toMatch(/CREATE TABLE IF NOT EXISTS public\.order_delivery_reports/);
    expect(body).toMatch(/WHERE NOT EXISTS/);
    expect(body).not.toMatch(/auto_complete_deadline_at\s*=/);
  });

  it('down reverses the columns and table', () => {
    expect(down).toMatch(/DROP TABLE IF EXISTS public\.order_delivery_reports/);
    expect(down).toMatch(/DROP COLUMN IF EXISTS delivered_at/);
  });

  it('never exposes dispute_reason to the agent role', () => {
    const yaml = readFileSync(join(META, 'public_orders.yaml'), 'utf8');
    const agentBlocks = yaml.split(/\n  - role: /).filter((b) => b.startsWith('agent'));
    expect(agentBlocks.length).toBeGreaterThan(0);
    for (const block of agentBlocks) expect(block).not.toContain('dispute_reason');
    expect(yaml).toContain('- delivered_at');
  });
});
