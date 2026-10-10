export type OpenCleanupKind = 'ai' | 'rembg';

type OpenCleanupRow = {
  image_id: string | null;
  kind: string;
};

type QueryRunner = {
  executeQuery: <T>(
    query: string,
    variables?: Record<string, unknown>
  ) => Promise<T>;
};

export function groupOpenCleanupKinds(
  rows: OpenCleanupRow[]
): Map<string, OpenCleanupKind[]> {
  const map = new Map<string, OpenCleanupKind[]>();
  for (const row of rows) {
    if (!row.image_id || (row.kind !== 'ai' && row.kind !== 'rembg')) continue;
    const list = map.get(row.image_id) ?? [];
    if (!list.includes(row.kind)) list.push(row.kind);
    map.set(row.image_id, list);
  }
  return map;
}

function openCleanupQuery(
  field: 'business_image_id' | 'rental_item_image_id'
): string {
  return `
    query OpenCleanupKinds($ids: [uuid!]!) {
      ai_image_cleanup_results(
        where: {
          ${field}: { _in: $ids }
          status: { _in: [queued, processing, ready] }
          job: { status: { _in: [queued, processing, ready_for_review] } }
        }
      ) {
        image_id: ${field}
        kind
      }
    }
  `;
}

export async function loadOpenCleanupKinds(
  hasura: QueryRunner,
  imageIds: string[],
  source: 'item' | 'rental'
): Promise<Map<string, OpenCleanupKind[]>> {
  if (!imageIds.length) return new Map();
  const field = source === 'item' ? 'business_image_id' : 'rental_item_image_id';
  const data = await hasura.executeQuery<{
    ai_image_cleanup_results: OpenCleanupRow[];
  }>(openCleanupQuery(field), { ids: imageIds });
  return groupOpenCleanupKinds(data.ai_image_cleanup_results ?? []);
}
