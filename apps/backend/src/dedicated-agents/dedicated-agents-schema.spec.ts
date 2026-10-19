import { readFileSync } from 'fs';
import { join } from 'path';
import {
  DEDICATED_APPLICATION_STATUSES,
  DEDICATED_ASSIGNMENT_SOURCES,
  DEDICATED_ASSIGNMENT_STATUSES,
  DEDICATED_CONFIG_KEYS,
  DEDICATED_NUMBER_CONFIG,
  DEDICATED_POSTING_STATUSES,
  DEDICATED_SLOT_KEYS,
  OFFER_DECLINE_REASONS,
  ORDER_ASSIGNMENT_SOURCES,
  ORDER_OFFER_KINDS,
} from './dedicated-agents.constants';
import { DELEGATION_PERMISSIONS } from '../delegations/delegation.constants';

/**
 * #594 PR 1 schema guards. The migrations were also run against Postgres
 * (PGlite: up -> constraint checks -> down -> up) when the PR was written;
 * these specs keep the SQL and Hasura metadata from drifting.
 */
const HASURA = join(__dirname, '../../../hasura');
const MIGRATIONS = join(HASURA, 'migrations/Rendasua');
const TABLES = join(HASURA, 'metadata/databases/Rendasua/tables');
const read = (...p: string[]) => readFileSync(join(...p), 'utf8');
const up = read(MIGRATIONS, '20261018180000_dedicated_agents_schema/up.sql');
const down = read(MIGRATIONS, '20261018180000_dedicated_agents_schema/down.sql');
const validate = read(MIGRATIONS, '20261018180001_dedicated_agents_validate_constraints/up.sql');
const validateDown = read(MIGRATIONS, '20261018180001_dedicated_agents_validate_constraints/down.sql');
/** SQL without `--` comments, so assertions only see statements. */
const code = (sql: string) => sql.replace(/--[^\n]*/g, '');
const sqlList = (values: readonly string[]) => values.map((v) => `'${v}'`).join(', ');

const NEW_TABLES = [
  'business_location_pickup_slots',
  'dedicated_agent_postings',
  'dedicated_agent_posting_slots',
  'dedicated_agent_applications',
  'dedicated_agent_assignments',
];

interface TableMeta {
  table: { name: string };
  select_permissions?: Array<{ role: string; permission: { columns: string[]; filter: unknown } }>;
  insert_permissions?: unknown[];
  update_permissions?: unknown[];
  delete_permissions?: unknown[];
}
/**
 * Minimal block-YAML reader for the Hasura table files written by this PR
 * (maps, sequences, plain scalars; no anchors or multi-line values), so the
 * spec doesn't depend on an undeclared YAML package.
 */
function parseSimpleYaml(text: string): unknown {
  const lines = text
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => ({ indent: l.length - l.trimStart().length, text: l.trim() }));
  let i = 0;
  const scalar = (v: string): unknown =>
    v === 'null' ? null : v === 'true' ? true : v === 'false' ? false : v.replace(/^"(.*)"$/, '$1');
  function block(indent: number): unknown {
    if (lines[i].text.startsWith('- ')) {
      const list: unknown[] = [];
      while (i < lines.length && lines[i].indent === indent && lines[i].text.startsWith('- ')) {
        const rest = lines[i].text.slice(2);
        if (!rest.includes(': ') && !rest.endsWith(':')) {
          list.push(scalar(rest));
          i++;
          continue;
        }
        lines[i] = { indent: indent + 2, text: rest };
        list.push(block(indent + 2));
      }
      return list;
    }
    const map: Record<string, unknown> = {};
    while (i < lines.length && lines[i].indent === indent && !lines[i].text.startsWith('- ')) {
      const { text: t } = lines[i];
      const idx = t.indexOf(':');
      const key = t.slice(0, idx);
      const value = t.slice(idx + 1).trim();
      i++;
      if (value) map[key] = scalar(value);
      else if (i < lines.length && lines[i].indent >= indent && (lines[i].indent > indent || lines[i].text.startsWith('- ')))
        map[key] = block(lines[i].indent);
      else map[key] = null;
    }
    return map;
  }
  return block(0);
}
const meta = (table: string) => parseSimpleYaml(read(TABLES, `public_${table}.yaml`)) as TableMeta;

describe('dedicated agents migration (20261018180000)', () => {
  it('seeds dedicated_agents_enabled = false, never a blind insert', () => {
    expect(up).toMatch(/\('dedicated_agents_enabled',[\s\S]*?'boolean', false,/);
    expect(up).toMatch(/WHERE NOT EXISTS \([\s\S]*?c\.country_code IS NULL/);
  });

  it('seeds every number key with the code default', () => {
    for (const [key, spec] of Object.entries(DEDICATED_NUMBER_CONFIG)) {
      expect(up).toMatch(new RegExp(`\\('${key}',[\\s\\S]*?'number', NULL, ${spec.fallback},`));
    }
    for (const key of DEDICATED_CONFIG_KEYS) expect(down).toContain(`'${key}'`);
  });

  it('keeps enum CHECKs in step with the backend constants', () => {
    expect(up).toContain(`slot_key IN (${sqlList(DEDICATED_SLOT_KEYS)})`);
    expect(up).toContain(`status IN (${sqlList(DEDICATED_ASSIGNMENT_STATUSES)})`);
    expect(up).toContain(`source IN (${sqlList(DEDICATED_ASSIGNMENT_SOURCES)})`);
    expect(up).toContain(`status IN (${sqlList(DEDICATED_POSTING_STATUSES)})`);
    expect(up).toMatch(new RegExp(`status IN \\(\\s*${sqlList(DEDICATED_APPLICATION_STATUSES)}\\s*\\)`));
    expect(up.replace(/\s+/g, ' ')).toContain(`assignment_source IN (${sqlList(ORDER_ASSIGNMENT_SOURCES)})`);
    expect(up).toContain(`offer_kind IN (${sqlList(ORDER_OFFER_KINDS)})`);
    expect(up).toContain(`decline_reason IN (${sqlList(OFFER_DECLINE_REASONS)})`);
  });

  it('enforces the posting rules in the schema (headcount 1-10, terms <= 1000, one open posting per slot)', () => {
    expect(up).toContain('CHECK (headcount BETWEEN 1 AND 10)');
    expect(up).toContain('char_length(terms) <= 1000');
    expect(up).toMatch(/UNIQUE INDEX[^;]*dedicated_agent_posting_slots_one_open_idx[\s\S]*?\(business_location_id, slot_key\) WHERE is_open/);
    expect(up).toContain("SET is_open = (NEW.status = 'open')");
  });

  it('keeps one live assignment per location-slot-agent and caps live assignments per agent under a row lock', () => {
    expect(up).toMatch(/dedicated_agent_assignments_live_unique_idx[\s\S]*?WHERE status IN \('active', 'paused'\)/);
    expect(up).toMatch(/FROM public\.agents WHERE id = NEW\.agent_id FOR NO KEY UPDATE;/);
    expect(up).toContain("config_key = 'dedicated_max_assignments_per_agent'");
    expect(up).toMatch(
      /^CREATE TRIGGER dedicated_agent_assignments_enforce_cap\s+BEFORE INSERT OR UPDATE OF status, agent_id ON public\.dedicated_agent_assignments\s+FOR EACH ROW EXECUTE FUNCTION public\.dedicated_agent_assignments_enforce_cap\(\);/m
    );
  });

  it('QA L2: locks the agent row FOR NO KEY UPDATE (does not block FK readers), never FOR UPDATE', () => {
    expect(code(up)).not.toMatch(/\bFOR UPDATE\b/);
    expect(code(up).match(/FOR NO KEY UPDATE/g)).toHaveLength(1);
  });

  it('QA L3: refuses assignment writes outside READ COMMITTED, after the early returns and before the lock', () => {
    const fn = code(up).slice(code(up).indexOf('FUNCTION public.dedicated_agent_assignments_enforce_cap'));
    const guard = fn.indexOf("IF current_setting('transaction_isolation') <> 'read committed' THEN");
    expect(guard).toBeGreaterThan(fn.indexOf("AND OLD.agent_id = NEW.agent_id THEN"));
    expect(guard).toBeLessThan(fn.indexOf('FOR NO KEY UPDATE'));
    expect(fn.slice(guard, fn.indexOf('END IF;', guard))).toContain(
      "RAISE EXCEPTION 'dedicated_agent_assignment_requires_read_committed"
    );
  });

  it('QA L5: the cap trigger resolves the cap like resolveDedicatedAgentsConfig (country row > global, range, fallback)', () => {
    const spec = DEDICATED_NUMBER_CONFIG.dedicated_max_assignments_per_agent;
    const fn = code(up).slice(code(up).indexOf('FUNCTION public.dedicated_agent_assignments_enforce_cap'));
    expect(fn).toContain(
      `cap := CASE WHEN raw IS NOT NULL AND raw = trunc(raw) AND raw BETWEEN ${spec.min} AND ${spec.max} THEN raw::integer ELSE ${spec.fallback} END;`
    );
    expect(fn.replace(/\s+/g, ' ')).toContain(
      "AND c.status = 'active' AND (NULLIF(btrim(c.country_code), '') IS NULL OR upper(btrim(c.country_code)) = location_country) ORDER BY (NULLIF(btrim(c.country_code), '') IS NULL) LIMIT 1;"
    );
    expect(fn.replace(/\s+/g, ' ')).toContain(
      'FROM public.business_locations bl JOIN public.addresses a ON a.id = bl.address_id WHERE bl.id = NEW.business_location_id;'
    );
    expect(fn).not.toMatch(/number_value::integer/);
  });

  it('QA L1: both migrations set a LOCAL 5 s lock_timeout before any other statement', () => {
    for (const sql of [up, validate]) {
      expect(code(sql).trim().split(';')[0].trim()).toBe("SET LOCAL lock_timeout = '5s'");
    }
  });

  it('QA L1: no index build on orders / order_offers while 180000 holds ACCESS EXCLUSIVE; 180001 builds them', () => {
    expect(code(up)).not.toMatch(/CREATE (UNIQUE )?INDEX[^;]*\bON public\.(orders|order_offers)\b/);
    expect(validate).toMatch(/CREATE INDEX IF NOT EXISTS orders_dedicated_assignment_idx\s+ON public\.orders \(dedicated_assignment_id\) WHERE dedicated_assignment_id IS NOT NULL;/);
    expect(validate).toMatch(/CREATE INDEX IF NOT EXISTS order_offers_dedicated_outstanding_idx\s+ON public\.order_offers \(agent_id, expires_at\) WHERE offer_kind = 'dedicated' AND status = 'offered';/);
    expect(validateDown).toContain('DROP INDEX IF EXISTS public.orders_dedicated_assignment_idx;');
    expect(validateDown).toContain('DROP INDEX IF EXISTS public.order_offers_dedicated_outstanding_idx;');
  });

  it('apply-hasura uses only flags Hasura CLI v2 supports (no --per-migration-transaction; v2 sends each file as its own run_sql)', () => {
    const action = readFileSync(join(__dirname, '../../../../.github/actions/apply-hasura/action.yml'), 'utf8');
    const applies = action.split('\n').filter((l) => /hasura migrate apply\b/.test(l) && !/run_logged|^\s*#/.test(l));
    expect(applies.length).toBeGreaterThan(0);
    for (const line of applies) expect(line).not.toMatch(/--per-migration-transaction/);
  });

  it('touches orders / order_offers without a table rewrite or a scan in 180000 (constraints NOT VALID, validated in 180001)', () => {
    const hot = up.slice(up.indexOf('-- 7. orders'));
    expect(hot).not.toMatch(/VALIDATE CONSTRAINT/);
    expect(hot.match(/NOT VALID/g)).toHaveLength(5);
    expect(hot).toMatch(/ADD COLUMN IF NOT EXISTS offer_kind text NOT NULL DEFAULT 'standard'/);
    for (const name of [
      'orders_coverage_slot_key_check',
      'orders_assignment_source_check',
      'orders_dedicated_assignment_id_fkey',
      'order_offers_offer_kind_check',
      'order_offers_decline_reason_check',
    ]) {
      expect(validate).toContain(`VALIDATE CONSTRAINT ${name};`);
    }
  });

  it('does not backfill pickup-slot rows (no row = enabled by default)', () => {
    expect(up).not.toMatch(/INSERT INTO public\.business_location_pickup_slots/);
    expect(up).toContain('is_enabled boolean NOT NULL DEFAULT true');
  });

  it('down drops every new table, column, config row and the delegation permission', () => {
    for (const t of NEW_TABLES) expect(down).toContain(`DROP TABLE IF EXISTS public.${t};`);
    for (const c of ['coverage_slot_key', 'dedicated_assignment_id', 'assignment_source', 'dedicated_release_until', 'offer_kind', 'decline_reason']) {
      expect(down).toContain(`DROP COLUMN IF EXISTS ${c}`);
    }
    expect(down).toContain("key = 'delegation.dedicated_agents.manage'");
  });

  it('seeds the delegation permission the backend checks', () => {
    expect(up).toContain(`'${DELEGATION_PERMISSIONS.DEDICATED_AGENTS_MANAGE}'`);
  });
});

describe('parseSimpleYaml', () => {
  it('reads nested maps and sequences', () => {
    expect(parseSimpleYaml('a:\n  - role: x\n    permission:\n      columns:\n        - id\n      filter: {}\nb: null\n')).toEqual({
      a: [{ role: 'x', permission: { columns: ['id'], filter: '{}' } }],
      b: null,
    });
  });
});

describe('dedicated agents Hasura metadata', () => {
  const includes = read(TABLES, 'tables.yaml');

  it('tracks every new table', () => {
    for (const t of NEW_TABLES) {
      expect(includes).toContain(`- "!include public_${t}.yaml"`);
      expect(meta(t).table.name).toBe(t);
    }
  });

  it('grants no insert, update or delete to any role (writes go through the backend)', () => {
    for (const t of NEW_TABLES) {
      const m = meta(t);
      expect(m.insert_permissions).toBeUndefined();
      expect(m.update_permissions).toBeUndefined();
      expect(m.delete_permissions).toBeUndefined();
    }
  });

  it('only agent and business roles can read, and every filter is scoped to X-Hasura-User-Id', () => {
    for (const t of NEW_TABLES) {
      const perms = meta(t).select_permissions ?? [];
      expect(perms.map((p) => p.role).sort()).toEqual(['agent', 'business']);
      for (const p of perms) {
        const filter = JSON.stringify(p.permission.filter);
        expect(filter).not.toBe('{}');
        expect(filter).toContain('X-Hasura-User-Id');
      }
    }
  });

  it('business owners are scoped to their own locations', () => {
    for (const t of NEW_TABLES) {
      const business = meta(t).select_permissions?.find((p) => p.role === 'business');
      expect(JSON.stringify(business?.permission.filter)).toMatch(
        /"business_location":\{"business":\{"user":\{"id":\{"_eq":"X-Hasura-User-Id"\}\}\}\}/
      );
    }
  });

  it('agents only see their own assignments and applications', () => {
    for (const t of ['dedicated_agent_assignments', 'dedicated_agent_applications']) {
      const agent = meta(t).select_permissions?.find((p) => p.role === 'agent');
      expect(agent?.permission.filter).toEqual({ agent: { user: { id: { _eq: 'X-Hasura-User-Id' } } } });
    }
  });

  it('QA M1: agents see only postings they applied to (Opportunities come from the backend with city/eligibility matching)', () => {
    const mine = { applications: { agent: { user: { id: { _eq: 'X-Hasura-User-Id' } } } } };
    const postings = meta('dedicated_agent_postings').select_permissions?.find((p) => p.role === 'agent');
    const slots = meta('dedicated_agent_posting_slots').select_permissions?.find((p) => p.role === 'agent');
    expect(postings?.permission.filter).toEqual(mine);
    expect(slots?.permission.filter).toEqual({ posting: mine });
  });

  it('QA M1: no agent filter opens rows by status (no "open postings" branch, no _or)', () => {
    for (const t of ['dedicated_agent_postings', 'dedicated_agent_posting_slots']) {
      const agent = meta(t).select_permissions?.find((p) => p.role === 'agent');
      expect(JSON.stringify(agent?.permission.filter)).not.toMatch(/"status"|"is_open"|"_or"/);
    }
    for (const t of NEW_TABLES) {
      const agent = meta(t).select_permissions?.find((p) => p.role === 'agent');
      expect(JSON.stringify(agent?.permission.filter)).not.toMatch(/"open"|"_or"/);
    }
  });

  it('never exposes actor user ids or relation-dismissal fields to Hasura roles', () => {
    const hidden = ['assigned_by_user_id', 'paused_by_user_id', 'removed_by_user_id', 'relation_dismissed_at', 'relation_dismissed_by_user_id', 'decided_by_user_id', 'created_by_user_id', 'closed_by_user_id', 'updated_by_user_id'];
    for (const t of NEW_TABLES) {
      for (const p of meta(t).select_permissions ?? []) {
        for (const col of hidden) expect(p.permission.columns).not.toContain(col);
      }
    }
  });
});
