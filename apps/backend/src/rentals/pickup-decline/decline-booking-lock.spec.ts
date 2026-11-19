import { withDeclineLock } from './decline-booking-lock';

describe('withDeclineLock', () => {
  it('fails closed when the pool is missing and does not run the decline', async () => {
    const work = jest.fn();
    await expect(withDeclineLock('booking-1', undefined, work)).rejects.toMatchObject({
      status: 503,
      response: { code: 'DECLINE_LOCK_UNAVAILABLE' },
    });
    expect(work).not.toHaveBeenCalled();
  });

  it('fails closed when the pool is not configured', async () => {
    const database = {
      transaction: async () => {
        throw new Error('Postgres pool is not configured (set DATABASE_URL)');
      },
      query: async () => [],
    };
    await expect(withDeclineLock('booking-2', database as never, async () => 'ran')).rejects.toMatchObject({
      status: 503,
      response: { code: 'DECLINE_LOCK_UNAVAILABLE' },
    });
  });

  it('returns refund already in progress when the lock times out', async () => {
    const database = {
      transaction: async () => {
        const error: any = new Error('canceling statement due to lock timeout');
        error.code = '55P03';
        throw error;
      },
      query: async () => [],
    };
    await expect(withDeclineLock('booking-3', database as never, async () => 'ran')).rejects.toMatchObject({
      status: 409,
      response: { code: 'REFUND_IN_PROGRESS' },
    });
  });

  it('returns refund already in progress when the pool connect times out', async () => {
    const database = {
      transaction: async () => {
        throw new Error('timeout exceeded when trying to connect');
      },
      query: async () => [],
    };
    await expect(withDeclineLock('booking-5', database as never, async () => 'ran')).rejects.toMatchObject({
      status: 409,
      response: { code: 'REFUND_IN_PROGRESS' },
    });
  });

  it('sets the lock and idle timeouts before the advisory lock, then runs the work', async () => {
    const seen: string[] = [];
    const database = {
      transaction: async (fn: (query: (text: string, params?: unknown[]) => Promise<unknown[]>) => Promise<unknown>) =>
        fn(async (text) => {
          seen.push(text);
          return [];
        }),
      query: async () => [],
    };
    const result = await withDeclineLock('booking-4', database as never, async () => {
      seen.push('work');
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(seen[0]).toContain('lock_timeout');
    expect(seen[1]).toContain('idle_in_transaction_session_timeout');
    expect(seen[2]).toContain('pg_advisory_xact_lock');
    expect(seen[3]).toBe('work');
  });
});
