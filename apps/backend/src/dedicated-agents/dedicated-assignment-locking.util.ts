/**
 * #594 assignment writes and the per-agent cap trigger
 * (`dedicated_agent_assignments_enforce_cap`, 20261018180000):
 *
 * - The trigger locks the agent row (FOR NO KEY UPDATE) for every live row it
 *   checks, in the order the rows are written. A transaction that writes
 *   assignments for several agents must therefore write them in agent_id order,
 *   or two such transactions can deadlock (QA L4). Use
 *   `orderAssignmentsForLocking` on the objects of a multi-row insert/update.
 * - Postgres may still abort one side with 40P01 (deadlock_detected) if another
 *   writer doesn't follow the order; that is safe to retry.
 * - Writes must run under READ COMMITTED (Hasura's isolation level). The trigger
 *   refuses REPEATABLE READ / SERIALIZABLE because the cap count would use a
 *   snapshot taken before the lock wait (QA L3).
 */
export const DEDICATED_ASSIGNMENT_RETRYABLE_SQLSTATES = ['40P01'] as const;

/** Postgres orders uuid by bytes, which matches lowercase hex string order. */
function lockKey(agentId: string): string {
  return agentId.trim().toLowerCase();
}

/** Stable sort by agent_id so every writer takes agent-row locks in the same order. */
export function orderAssignmentsForLocking<T extends { agent_id: string }>(rows: readonly T[]): T[] {
  return rows
    .map((row, index) => ({ row, index, key: lockKey(row.agent_id) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.index - b.index))
    .map(({ row }) => row);
}

/** True for a deadlock abort (Hasura surfaces the SQLSTATE in extensions.internal.error, or the message). */
export function isRetryableAssignmentError(error: unknown): boolean {
  const e = error as {
    code?: string;
    message?: string;
    extensions?: { internal?: { error?: { status_code?: string } } };
    response?: { errors?: Array<{ message?: string; extensions?: { internal?: { error?: { status_code?: string } } } }> };
  } | null;
  if (!e) return false;
  const codes = [
    e.code,
    e.extensions?.internal?.error?.status_code,
    ...(e.response?.errors ?? []).map((x) => x.extensions?.internal?.error?.status_code),
  ];
  if (codes.some((c) => c && (DEDICATED_ASSIGNMENT_RETRYABLE_SQLSTATES as readonly string[]).includes(c))) {
    return true;
  }
  const messages = [e.message, ...(e.response?.errors ?? []).map((x) => x.message)];
  return messages.some((m) => typeof m === 'string' && /deadlock detected/i.test(m));
}
