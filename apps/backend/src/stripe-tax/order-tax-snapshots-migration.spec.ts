import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '../../../hasura');
const DIR = join(ROOT, 'migrations/Rendasua/20261028090000_order_tax_snapshots');
const up = readFileSync(join(DIR, 'up.sql'), 'utf8');
const down = readFileSync(join(DIR, 'down.sql'), 'utf8');
const tables = readFileSync(join(ROOT, 'metadata/databases/Rendasua/tables/tables.yaml'), 'utf8');
const snapshotMeta = readFileSync(
  join(ROOT, 'metadata/databases/Rendasua/tables/public_order_tax_snapshots.yaml'),
  'utf8'
);
const reversalMeta = readFileSync(
  join(ROOT, 'metadata/databases/Rendasua/tables/public_order_tax_reversals.yaml'),
  'utf8'
);
const ordersMeta = readFileSync(join(ROOT, 'metadata/databases/Rendasua/tables/public_orders.yaml'), 'utf8');

describe('20261028090000_order_tax_snapshots', () => {
  it('does not alter orders money columns', () => {
    expect(up).not.toMatch(/ALTER TABLE public\.orders\s+(ADD|ALTER|DROP) COLUMN/i);
    expect(up).not.toMatch(/\b(total_amount|tax_amount|pre_tax_total)\b[^\n]*\b(SET|DEFAULT|TYPE)\b/i);
    expect(up).not.toMatch(/UPDATE public\.orders/i);
  });

  it('widens the tax_status check to include void, validated after NOT VALID', () => {
    expect(up).toMatch(/CHECK \(tax_status IN \('none', 'estimated', 'finalized', 'void'\)\) NOT VALID/);
    expect(up).toMatch(/VALIDATE CONSTRAINT orders_tax_status_check/);
    expect(down).toMatch(/SET tax_status = 'estimated'[\s\S]*tax_status = 'void'/);
    expect(down).toMatch(/CHECK \(tax_status IN \('none', 'estimated', 'finalized'\)\)/);
  });

  it('backs the idempotency guards with unique constraints the backend names', () => {
    expect(up).toMatch(/order_id uuid NOT NULL UNIQUE REFERENCES public\.orders/);
    expect(up).toMatch(/stripe_refund_id text NOT NULL UNIQUE/);
    expect(up).toMatch(/reference text NOT NULL UNIQUE/);
    // Constraint names the repository passes to on_conflict (Postgres default naming).
    expect(up).toContain('order_tax_snapshots');
    expect(up).toContain('order_tax_reversals');
  });

  it('has a down migration dropping both tables and does not backfill', () => {
    expect(down).toMatch(/DROP TABLE IF EXISTS public\.order_tax_reversals/);
    expect(down).toMatch(/DROP TABLE IF EXISTS public\.order_tax_snapshots/);
    expect(up).not.toMatch(/INSERT INTO public\.order_tax_snapshots/i);
  });

  it('tracks both tables and exposes the snapshot only to the owning client (no reversal permissions)', () => {
    expect(tables).toContain('public_order_tax_snapshots.yaml');
    expect(tables).toContain('public_order_tax_reversals.yaml');
    expect(snapshotMeta).toMatch(/role: client/);
    expect(snapshotMeta).toContain('X-Hasura-User-Id');
    expect(snapshotMeta).not.toMatch(/insert_permissions|update_permissions|delete_permissions/);
    expect(snapshotMeta).not.toContain('stripe_tax_transaction_id');
    expect(reversalMeta).not.toMatch(/_permissions/);
    expect(ordersMeta).toContain('tax_snapshot');
  });
});

describe('20261028100000_stripe_refund_tax_amount', () => {
  const dir = join(ROOT, 'migrations/Rendasua/20261028100000_stripe_refund_tax_amount');
  const rup = readFileSync(join(dir, 'up.sql'), 'utf8');
  const rdown = readFileSync(join(dir, 'down.sql'), 'utf8');

  it('is additive with a constant default and a non-negative check', () => {
    expect(rup).toMatch(/ADD COLUMN IF NOT EXISTS tax_refund_amount numeric\(12, 2\) NOT NULL DEFAULT 0/);
    expect(rup).toMatch(/CHECK \(tax_refund_amount >= 0\)/);
    expect(rup).not.toMatch(/\bDROP\b|UPDATE public\./i);
  });

  it('has a down that drops only that column', () => {
    expect(rdown).toMatch(/DROP COLUMN IF EXISTS tax_refund_amount/);
    expect(rdown.match(/DROP COLUMN/gi)).toHaveLength(1);
  });
});
