import { ConflictException } from '@nestjs/common';
import { isRetryableAssignmentError } from './dedicated-assignment-locking.util';

/** Error codes the API returns for a refused assignment write (409). */
export const DEDICATED_ASSIGNMENT_CONFLICTS = {
  capExceeded: 'dedicated_agent_assignment_cap_exceeded',
  duplicate: 'dedicated_agent_assignment_duplicate',
} as const;

const MAX_ATTEMPTS = 3;

function errorText(error: unknown): string {
  const e = error as { message?: unknown; response?: { errors?: unknown } } | null;
  const parts = [typeof e?.message === 'string' ? e.message : ''];
  try {
    if (e?.response?.errors) parts.push(JSON.stringify(e.response.errors));
  } catch {
    // ignore unserialisable payloads
  }
  return parts.join(' ');
}

/** The cap trigger (20261018180000) refused the row: the agent already has the max live assignments. */
export function isAssignmentCapError(error: unknown): boolean {
  return errorText(error).includes('dedicated_agent_assignment_cap_exceeded');
}

/** The live-unique index: this agent already holds this location-slot (active or paused). */
export function isAssignmentDuplicateError(error: unknown): boolean {
  const text = errorText(error);
  return (
    text.includes('dedicated_agent_assignments_live_unique_idx') ||
    /Uniqueness violation/i.test(text)
  );
}

/** Cap / duplicate -> 409 with a stable code; anything else unchanged. */
export function mapAssignmentWriteError(error: unknown): unknown {
  if (isAssignmentCapError(error)) {
    return new ConflictException({
      code: DEDICATED_ASSIGNMENT_CONFLICTS.capExceeded,
      message: 'This agent already has the maximum number of dedicated assignments',
    });
  }
  if (isAssignmentDuplicateError(error)) {
    return new ConflictException({
      code: DEDICATED_ASSIGNMENT_CONFLICTS.duplicate,
      message: 'This agent is already dedicated to this slot',
    });
  }
  return error;
}

/**
 * Every assignment write goes through here: retry a deadlock abort (40P01)
 * up to 3 attempts with a short backoff, then map cap / duplicate errors to
 * 409. Callers pass rows already sorted with `orderAssignmentsForLocking`.
 */
export async function runAssignmentWrite<T>(
  write: () => Promise<T>,
  options: { maxAttempts?: number; backoffMs?: number } = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS;
  const backoffMs = options.backoffMs ?? 25;
  for (let attempt = 1; ; attempt++) {
    try {
      return await write();
    } catch (error) {
      if (attempt < maxAttempts && isRetryableAssignmentError(error)) {
        if (backoffMs > 0) await new Promise((r) => setTimeout(r, backoffMs * attempt));
        continue;
      }
      throw mapAssignmentWriteError(error);
    }
  }
}
