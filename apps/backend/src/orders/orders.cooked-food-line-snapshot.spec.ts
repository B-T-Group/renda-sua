import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { GET_ORDER_BY_ID, GET_ORDERS } from './orders.queries';

function firstExisting(paths: string[]): string {
  const path = paths.find((candidate) => existsSync(candidate));
  if (!path) {
    throw new Error(`None of these files exist: ${paths.join(', ')}`);
  }
  return path;
}

function loadRepoFile(relativeFromRoot: string): string {
  return readFileSync(
    firstExisting([
      join(process.cwd(), relativeFromRoot),
      join(process.cwd(), '..', relativeFromRoot.replace(/^apps\//, '')),
      join(process.cwd(), '../..', relativeFromRoot),
      join(__dirname, '../../../../', relativeFromRoot),
    ]),
    'utf8'
  );
}

/** Direct field names inside the first `order_items { ... }` selection. */
function directOrderItemFields(query: string): string[] {
  const start = query.indexOf('order_items {');
  if (start < 0) {
    throw new Error('Query has no order_items selection');
  }
  const open = query.indexOf('{', start);
  let depth = 0;
  const fields: string[] = [];
  for (let i = open; i < query.length; i += 1) {
    const ch = query[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
    if (depth !== 1) continue;
    const rest = query.slice(i);
    const match = rest.match(/^([A-Za-z_][A-Za-z0-9_]*)\b/);
    if (match) {
      fields.push(match[1]);
      i += match[1].length - 1;
    }
  }
  return fields;
}

describe('order_items.is_cooked_food snapshot', () => {
  it('lists is_cooked_food on order_items in GET_ORDERS', () => {
    const fields = directOrderItemFields(String(GET_ORDERS));
    expect(fields).toContain('is_cooked_food');
    expect(fields).toContain('item');
  });

  it('lists is_cooked_food on order_items in GET_ORDER_BY_ID', () => {
    const fields = directOrderItemFields(String(GET_ORDER_BY_ID));
    expect(fields).toContain('is_cooked_food');
    expect(fields).toContain('item');
  });

  it('exposes is_cooked_food on Hasura order_items insert and select', () => {
    const yaml = loadRepoFile(
      'apps/hasura/metadata/databases/Rendasua/tables/public_order_items.yaml'
    );
    const occurrences = yaml.split('is_cooked_food').length - 1;
    expect(occurrences).toBe(4);
  });

  it('snapshots cooked-food on create and reads it on order detail queries', () => {
    const service = loadRepoFile('apps/backend/src/orders/orders.service.ts');
    expect(service).toContain('is_cooked_food: lineIsCookedFood({');
    expect(service.match(/order_items \{[\s\S]*?is_cooked_food/g)?.length).toBeGreaterThanOrEqual(
      3
    );
  });
});
