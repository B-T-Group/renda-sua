import type { DatabaseService } from '../../database/database.service';

const gates = new Map<string, Promise<unknown>>();

/** One decline per booking. The lock is held until the debit and the payout claim finish. */
export function withDeclineLock<T>(
  bookingId: string,
  database: DatabaseService | undefined,
  work: () => Promise<T>
): Promise<T> {
  const previous = gates.get(bookingId) ?? Promise.resolve();
  const current = previous.then(
    () => runLocked(database, bookingId, work),
    () => runLocked(database, bookingId, work)
  );
  gates.set(bookingId, current);
  return finishGate(bookingId, current);
}

function finishGate<T>(bookingId: string, current: Promise<T>): Promise<T> {
  return current.finally(() => {
    if (gates.get(bookingId) === current) gates.delete(bookingId);
  });
}

async function runLocked<T>(
  database: DatabaseService | undefined,
  bookingId: string,
  work: () => Promise<T>
): Promise<T> {
  if (!database) return work();
  try {
    return await database.transaction((query) => holdBooking(query, bookingId, work));
  } catch (error: any) {
    if (poolMissing(error)) return work();
    throw error;
  }
}

async function holdBooking<T>(
  query: (text: string, params?: unknown[]) => Promise<unknown>,
  bookingId: string,
  work: () => Promise<T>
): Promise<T> {
  await query(LOCK_SQL, [bookingId]);
  return work();
}

function poolMissing(error: any): boolean {
  return String(error?.message ?? '').includes('Postgres pool is not configured');
}

const LOCK_SQL = `SELECT pg_advisory_xact_lock(('x' || substr(md5($1), 1, 16))::bit(64)::bigint)`;
