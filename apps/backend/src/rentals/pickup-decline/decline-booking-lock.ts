import { HttpException, HttpStatus } from '@nestjs/common';
import type { DatabaseService } from '../../database/database.service';

const gates = new Map<string, Promise<unknown>>();

/** How long a second tap waits for the booking lock before 409. */
export const DECLINE_LOCK_TIMEOUT = '4s';
/** Releases a lock transaction that stops issuing queries. */
export const DECLINE_IDLE_TX_TIMEOUT = '8s';

/** One decline per booking. The provider call runs after this transaction commits. */
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
  if (!database) throw lockUnavailable();
  try {
    return await database.transaction((query) => holdBooking(query, bookingId, work));
  } catch (error: any) {
    const mapped = mapLockError(error);
    if (mapped) throw mapped;
    throw error;
  }
}

async function holdBooking<T>(
  query: (text: string, params?: unknown[]) => Promise<unknown>,
  bookingId: string,
  work: () => Promise<T>
): Promise<T> {
  await query(`SELECT set_config('lock_timeout', $1, true)`, [DECLINE_LOCK_TIMEOUT]);
  await query(`SELECT set_config('idle_in_transaction_session_timeout', $1, true)`, [DECLINE_IDLE_TX_TIMEOUT]);
  await query(LOCK_SQL, [bookingId]);
  return work();
}

function mapLockError(error: any): HttpException | null {
  if (isHttp(error)) return null;
  if (poolDown(error)) return lockUnavailable();
  if (lockWait(error)) return refundBusy();
  return null;
}

function poolDown(error: any): boolean {
  const text = `${error?.message ?? ''} ${error?.code ?? ''}`.toLowerCase();
  return text.includes('postgres pool is not configured') || text.includes('econnrefused') || text.includes('enotfound');
}

function lockWait(error: any): boolean {
  const text = `${error?.message ?? ''} ${error?.code ?? ''}`.toLowerCase();
  return text.includes('lock timeout') || text.includes('55p03') || text.includes('25p03')
    || text.includes('idle-in-transaction') || text.includes('timeout exceeded when trying to connect');
}

function isHttp(error: any): boolean {
  return typeof error?.getStatus === 'function';
}

export function lockUnavailable(): HttpException {
  return new HttpException(
    { message: 'Decline lock is unavailable', code: 'DECLINE_LOCK_UNAVAILABLE' },
    HttpStatus.SERVICE_UNAVAILABLE
  );
}

function refundBusy(): HttpException {
  return new HttpException(
    { message: 'refund already in progress', code: 'REFUND_IN_PROGRESS' },
    HttpStatus.CONFLICT
  );
}

const LOCK_SQL = `SELECT pg_advisory_xact_lock(('x' || substr(md5($1), 1, 16))::bit(64)::bigint)`;
