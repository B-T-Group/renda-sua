import type { HasuraSystemService } from '../hasura/hasura-system.service';

/**
 * #627 C4/C7/C8: durable progress of one admin cancel, as ONE order_events row
 * (event_type `admin_cancel_progress`) per order.
 *
 * - Per-step done markers: each step is `pending` -> `running` -> `done` | `failed`.
 *   A `done` step is never run again.
 * - At most once: a step is marked `running` (CAS) BEFORE it runs. A step found
 *   `running` after its lease has expired may have run (the process died mid-step). A
 *   repeatable step (idempotent on its own keys) is run again; a non-repeatable one
 *   (reserved-stock decrement, inventory hook) is never re-run automatically. It is
 *   reported as `uncertain` and alerted for a human.
 * - One resume at a time: a lease (`leaseOwner`, `leaseUntil`) is claimed by a
 *   compare-and-set on `version` (UPDATE ... WHERE id = $id AND payload @> {version:n}).
 *   A concurrent retry loses the CAS, or sees a live lease, and gets 409. Every step
 *   transition is a CAS too, so a holder whose lease was taken over stops.
 * - C8: found by order and event type (no newest-100 window).
 */
export const ADMIN_CANCEL_PROGRESS_EVENT = 'admin_cancel_progress';
export const ADMIN_CANCEL_LEASE_MS = 120_000;

export const ADMIN_CANCEL_STEPS = [
  'voidStripeAuthorization',
  'persistCancellationMetadata',
  'createStatusHistoryEntry',
  'restorePurchaseCredits',
  'releaseReservedStock',
  'inventoryReleaseHook',
  'depositRefund',
  'enqueueOrderCancelled',
] as const;
export type AdminCancelStepName = (typeof ADMIN_CANCEL_STEPS)[number];

/** Steps that are NOT idempotent on their own: never re-run after an unknown outcome. */
export const ADMIN_CANCEL_NON_REPEATABLE: readonly AdminCancelStepName[] = [
  'releaseReservedStock',
  'inventoryReleaseHook',
];

export type AdminCancelStepState = 'pending' | 'running' | 'done' | 'failed';

export interface AdminCancelProgress {
  version: number;
  previousStatus: string;
  notes: string | null;
  adminUserId: string | null;
  steps: Record<AdminCancelStepName, AdminCancelStepState>;
  leaseOwner: string | null;
  leaseUntil: string | null;
}

export interface AdminCancelProgressRow {
  id: string;
  payload: AdminCancelProgress;
}

type Hasura = Pick<HasuraSystemService, 'executeQuery' | 'executeMutation'>;

export async function loadAdminCancelProgress(
  hasura: Hasura,
  orderId: string
): Promise<AdminCancelProgressRow | null> {
  const res = await hasura.executeQuery<{
    order_events: Array<{ id: string; payload: AdminCancelProgress }>;
  }>(
    `query AdminCancelProgress($orderId: uuid!, $type: String!) {
      order_events(
        where: { order_id: { _eq: $orderId }, event_type: { _eq: $type } }
        order_by: { created_at: asc }
        limit: 1
      ) { id payload }
    }`,
    { orderId, type: ADMIN_CANCEL_PROGRESS_EVENT }
  );
  return res?.order_events?.[0] ?? null;
}

export async function insertAdminCancelProgress(
  hasura: Hasura,
  orderId: string,
  actorId: string | null,
  payload: AdminCancelProgress
): Promise<AdminCancelProgressRow> {
  const res = await hasura.executeMutation<{ insert_order_events_one: { id: string } }>(
    `mutation InsertAdminCancelProgress($orderId: uuid!, $type: String!, $actorId: uuid, $payload: jsonb!) {
      insert_order_events_one(object: {
        order_id: $orderId, event_type: $type, actor_type: "support", actor_id: $actorId, payload: $payload
      }) { id }
    }`,
    { orderId, type: ADMIN_CANCEL_PROGRESS_EVENT, actorId, payload }
  );
  return { id: res.insert_order_events_one.id, payload };
}

/** CAS: write `next` (version + 1) only if the row is still at `current.version`. */
export async function casAdminCancelProgress(
  hasura: Hasura,
  row: AdminCancelProgressRow,
  next: Omit<AdminCancelProgress, 'version'>
): Promise<AdminCancelProgressRow | null> {
  const payload = { ...next, version: row.payload.version + 1 };
  const res = await hasura.executeMutation<{ update_order_events: { affected_rows: number } }>(
    `mutation CasAdminCancelProgress($id: uuid!, $expect: jsonb!, $payload: jsonb!) {
      update_order_events(
        where: { id: { _eq: $id }, payload: { _contains: $expect } }
        _set: { payload: $payload }
      ) { affected_rows }
    }`,
    { id: row.id, expect: { version: row.payload.version }, payload }
  );
  return res?.update_order_events?.affected_rows === 1 ? { id: row.id, payload } : null;
}

export function leaseIsLive(p: AdminCancelProgress, now = Date.now()): boolean {
  return !!p.leaseOwner && !!p.leaseUntil && Date.parse(p.leaseUntil) > now;
}

export function pendingSteps(p: AdminCancelProgress): AdminCancelStepName[] {
  return ADMIN_CANCEL_STEPS.filter((s) => (p.steps?.[s] ?? 'pending') !== 'done');
}
