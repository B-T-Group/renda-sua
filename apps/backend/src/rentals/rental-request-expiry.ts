import {
  computeRespondBy,
  earliestRequestStartIso,
  type RentalRespondWindow,
} from './rental-respond-by';

export interface UnansweredRentalRequest {
  id: string;
  created_at: string;
  requested_start_at?: string | null;
  rental_selection_windows?: unknown;
  clientUserId: string | null;
  businessUserId: string | null;
  itemName: string;
  businessName: string;
  renterName: string;
  listingId: string;
}

export interface ExpireUnansweredDeps {
  now: Date;
  isEnabled: () => Promise<boolean>;
  listPending: () => Promise<UnansweredRentalRequest[]>;
  casDecline: (id: string, respondedAt: string) => Promise<boolean>;
  releaseHolds: (requestId: string) => Promise<void>;
  notify: (row: UnansweredRentalRequest, window: RentalRespondWindow) => Promise<void>;
}

/** Decline pending requests past respond_by. A lost compare-and-set skips side effects. */
export async function expireUnansweredRentalRequests(deps: ExpireUnansweredDeps): Promise<number> {
  if (!(await deps.isEnabled())) return 0;
  const rows = await deps.listPending();
  let expired = 0;
  for (const row of rows) {
    if (await expireOneUnanswered(deps, row)) expired += 1;
  }
  return expired;
}

async function expireOneUnanswered(
  deps: ExpireUnansweredDeps,
  row: UnansweredRentalRequest
): Promise<boolean> {
  const decision = computeRespondBy({
    createdAt: row.created_at,
    startAt: earliestRequestStartIso(row),
  });
  if (Date.parse(decision.respondBy) > deps.now.getTime()) return false;
  const won = await deps.casDecline(row.id, deps.now.toISOString());
  if (!won) return false;
  await releaseThenNotify(deps, row, decision.window);
  return true;
}

async function releaseThenNotify(
  deps: ExpireUnansweredDeps,
  row: UnansweredRentalRequest,
  window: RentalRespondWindow
): Promise<void> {
  try {
    await deps.releaseHolds(row.id);
  } catch {
    // The compare-and-set already won. Still notify.
  }
  await deps.notify(row, window);
}
