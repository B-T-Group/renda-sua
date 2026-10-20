/**
 * #630 / #631: user-role (non-admin) INSERT / UPDATE / DELETE permissions on orders and
 * on the money tables, pinned EXACTLY. Every money write goes through the backend or a
 * Lambda with the admin secret; the audit table in #630 lists, per column, who uses it.
 * Adding a column or role here is a deliberate, reviewed change: update the pinned list
 * and the #630 audit together.
 */
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const DIRS = [
  join(process.cwd(), 'apps/hasura/metadata/databases/Rendasua/tables'),
  join(__dirname, '../../../hasura/metadata/databases/Rendasua/tables'),
];
const DIR = DIRS.find((d) => existsSync(d)) as string;
const KINDS = ['insert', 'update', 'delete'] as const;
type Kind = (typeof KINDS)[number];

/** role -> columns ('<all>' for a delete or a column-less permission) for one kind. */
export function writePermissions(table: string, kind: Kind): Record<string, string[]> {
  const text = readFileSync(join(DIR, `public_${table}.yaml`), 'utf8');
  const m = new RegExp(`(?:^|\\n)${kind}_permissions:\\n`).exec(text);
  if (!m) return {};
  const rest = text.slice(m.index + m[0].length);
  const end = rest.search(/\n[a-z_]+:/);
  const section = end === -1 ? rest : rest.slice(0, end + 1);
  const out: Record<string, string[]> = {};
  for (const block of ('\n' + section).split(/\n {2}- role: /).slice(1)) {
    const role = block.split('\n')[0].trim();
    const cols = /\n {6}columns:\n((?: {8}- .*\n?)+)/.exec(block + '\n');
    out[role] = cols
      ? cols[1].split('\n').map((l) => l.replace(/^\s*- /, '').trim()).filter(Boolean).sort()
      : ['<all>'];
  }
  return out;
}

const sorted = (o: Record<string, string[]>) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, [...v].sort()]));

/** The ONLY user-role writes allowed on these tables after #631 (table -> kind -> role -> columns). */
const PINNED: Record<string, Partial<Record<Kind, Record<string, string[]>>>> = {
  orders: {
    insert: {},
    update: {
      agent: ['actual_delivery_time', 'updated_at'],
      business: ['estimated_delivery_time', 'updated_at'],
      client: ['preferred_delivery_time', 'special_instructions', 'updated_at'],
    },
    delete: {},
  },
  order_items: { insert: {}, update: {}, delete: {} },
  accounts: { insert: {}, update: {}, delete: {} },
  account_transactions: { insert: {}, update: {}, delete: {} },
  order_holds: { insert: {}, update: {}, delete: {} },
  airtel_money_payments: { insert: {}, update: {}, delete: {} },
  mtn_momo_payment_requests: { insert: {}, update: {}, delete: {} },
  orange_momo_payment_requests: { insert: {}, update: {}, delete: {} },
  mobile_payment_transactions: { insert: {}, update: {}, delete: {} },
  failed_deliveries: {
    insert: { agent: ['failure_reason_id', 'notes', 'order_id'] },
    update: {},
    delete: {},
  },
};

/** Money-affecting columns no user role may write on these tables. */
const NEVER: Record<string, string[]> = {
  agents: ['auto_withdraw_commissions', 'mobile_payment_phone_id'],
  business_locations: [
    'auto_withdraw_commissions',
    'mobile_payment_phone_id',
    'pay_at_confirm',
    'rendasua_item_commission_percentage',
  ],
  partners: ['base_delivery_fee_commission', 'item_commission', 'per_km_delivery_fee_commission'],
};

describe('user-role write permissions on orders and money tables (#630)', () => {
  it('the parser reads real permissions (guards against a vacuous pass)', () => {
    expect(writePermissions('orders', 'update').business).toContain('estimated_delivery_time');
    expect(Object.keys(writePermissions('orders', 'select' as Kind))).toContain('client');
    expect(writePermissions('business_locations', 'update').business).toContain('name');
    expect(writePermissions('business_locations', 'delete').business).toEqual(['<all>']);
    expect(writePermissions('partners', 'update').partner).toContain('company_name');
  });

  for (const [table, kinds] of Object.entries(PINNED)) {
    for (const kind of KINDS) {
      it(`${table} ${kind}: exactly the pinned roles and columns`, () => {
        const path = join(DIR, `public_${table}.yaml`);
        const actual = existsSync(path) ? sorted(writePermissions(table, kind)) : {};
        expect(actual).toEqual(sorted(kinds[kind] ?? {}));
      });
    }
  }

  it.each(Object.entries(NEVER))('%s: no role writes a money-affecting column', (table, cols) => {
    for (const kind of KINDS) {
      for (const [role, columns] of Object.entries(writePermissions(table, kind))) {
        expect([table, kind, role, columns.filter((c) => cols.includes(c))]).toEqual([table, kind, role, []]);
      }
    }
  });

  it('every table with a user-role write that names a money column is reviewed here', () => {
    // A new table (or a new money column on another table) with a user-role write fails
    // this until it is audited in #630 and added to PINNED / NEVER / REVIEWED.
    const money = /amount|balance|fee|total|price|cost|payment|refund|deposit|hold|commission|credit|payout|withdraw|reconcil|cash/;
    const REVIEWED_KEEP: Record<string, string[]> = {
      // Merchant-owned catalog prices, written by the business (backend user role):
      // business-items.service.ts, rentals.service.ts, frontend useBusinessInventory.ts.
      items: ['initial_deposit_enabled', 'initial_deposit_percent', 'price', 'shipping_price'],
      item_variants: ['price'],
      business_inventory: ['selling_price', 'unit_cost'],
      business_inventory_variant_price_overrides: ['selling_price'],
      rental_location_listings: ['base_price_per_day', 'base_price_per_hour', 'security_deposit_amount'],
    };
    const covered = new Set([...Object.keys(PINNED), ...Object.keys(NEVER)]);
    const found: string[] = [];
    for (const f of readdirSync(DIR).filter((n) => /^public_.*\.yaml$/.test(n))) {
      const table = f.replace(/^public_|\.yaml$/g, '');
      if (covered.has(table)) continue;
      for (const kind of ['insert', 'update'] as Kind[]) {
        for (const [role, columns] of Object.entries(writePermissions(table, kind))) {
          for (const c of columns) {
            if (money.test(c) && !(REVIEWED_KEEP[table] ?? []).includes(c)) found.push(`${table}.${kind}.${role}.${c}`);
          }
        }
      }
    }
    expect(found).toEqual([]);
  });
});
