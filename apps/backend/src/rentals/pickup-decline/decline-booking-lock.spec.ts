import { HttpException, HttpStatus } from '@nestjs/common';
import { DECLINE_IDLE_TX_TIMEOUT, DECLINE_LOCK_TIMEOUT, withDeclineLock } from './decline-booking-lock';

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
    expect(seen[0]).toBe(`SELECT set_config('lock_timeout', $1, true)`);
    expect(seen[1]).toBe(`SELECT set_config('idle_in_transaction_session_timeout', $1, true)`);
    expect(seen[2]).toContain('pg_advisory_xact_lock');
    expect(seen[3]).toBe('work');
    expect(DECLINE_LOCK_TIMEOUT).toBe('4s');
    expect(DECLINE_IDLE_TX_TIMEOUT).toBe('8s');
  });

  it('keeps the 4s lock wait and the 8s idle timeout on this booking only', async () => {
    const calls: Array<{ text: string; params?: unknown[] }> = [];
    const database = lockingDb((text, params) => calls.push({ text, params }));
    await withDeclineLock('booking-9', database, async () => 'ok');
    expect(calls[0]).toEqual({
      text: `SELECT set_config('lock_timeout', $1, true)`,
      params: ['4s'],
    });
    expect(calls[1]).toEqual({
      text: `SELECT set_config('idle_in_transaction_session_timeout', $1, true)`,
      params: ['8s'],
    });
    expect(calls[2].params).toEqual(['booking-9']);
    expect(calls[2].text).toContain('pg_advisory_xact_lock');
  });

  it.each([
    ['ECONNREFUSED', 503, 'DECLINE_LOCK_UNAVAILABLE'],
    ['ENOTFOUND', 503, 'DECLINE_LOCK_UNAVAILABLE'],
    ['25P03', 409, 'REFUND_IN_PROGRESS'],
  ])('maps pool code %s to %s %s and does not run the decline', async (code, status, responseCode) => {
    const database = {
      transaction: async () => {
        const error: any = new Error('db down');
        error.code = code;
        throw error;
      },
      query: async () => [],
    };
    const work = jest.fn();
    await expect(withDeclineLock(`booking-${code}`, database as never, work)).rejects.toMatchObject({
      status,
      response: { code: responseCode },
    });
    expect(work).not.toHaveBeenCalled();
  });

  it('returns refund already in progress when the idle transaction is cancelled', async () => {
    const database = {
      transaction: async () => {
        throw new Error('terminating connection due to idle-in-transaction timeout');
      },
      query: async () => [],
    };
    await expect(withDeclineLock('booking-idle', database as never, jest.fn())).rejects.toMatchObject({
      status: 409,
      response: { code: 'REFUND_IN_PROGRESS', message: 'refund already in progress' },
    });
  });

  it('leaves a validation error and a unique violation unwrapped', async () => {
    const database = lockingDb();
    await expect(withDeclineLock('booking-http', database, async () => {
      throw new HttpException({ message: 'Version mismatch', code: 'VERSION_MISMATCH' }, HttpStatus.BAD_REQUEST);
    })).rejects.toMatchObject({ status: 400, response: { code: 'VERSION_MISMATCH' } });

    const unique: any = new Error('duplicate key value violates unique constraint');
    unique.code = '23505';
    await expect(withDeclineLock('booking-unique', database, async () => {
      throw unique;
    })).rejects.toBe(unique);
  });

  it('does not report a provider timeout as refund already in progress', async () => {
    const database = lockingDb();
    await expect(withDeclineLock('booking-provider', database, async () => {
      throw new Error('FedaPay lookup timed out after 8000ms');
    })).rejects.toThrow('FedaPay lookup timed out after 8000ms');
  });

  it('runs one decline at a time for a booking and still runs the next after a failure', async () => {
    let release: () => void = () => undefined;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    let active = 0;
    let maxActive = 0;
    const database = lockingDb();
    const first = withDeclineLock('booking-serial', database, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await hold;
      active -= 1;
      throw new Error('provider down');
    });
    let secondEntered = false;
    const second = withDeclineLock('booking-serial', database, async () => {
      secondEntered = true;
      active += 1;
      maxActive = Math.max(maxActive, active);
      active -= 1;
      return 'second';
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(secondEntered).toBe(false);
    expect(maxActive).toBe(1);
    release();
    await expect(first).rejects.toThrow('provider down');
    await expect(second).resolves.toBe('second');
    expect(maxActive).toBe(1);
  });

  it('lets two bookings take the lock at the same time', async () => {
    let release: () => void = () => undefined;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    let otherEntered = false;
    const database = lockingDb();
    const left = withDeclineLock('booking-left', database, async () => {
      await hold;
      return 'left';
    });
    const right = withDeclineLock('booking-right', database, async () => {
      otherEntered = true;
      return 'right';
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(otherEntered).toBe(true);
    await expect(right).resolves.toBe('right');
    release();
    await expect(left).resolves.toBe('left');
  });
});

function lockingDb(onQuery?: (text: string, params?: unknown[]) => void) {
  return {
    transaction: async (fn: (query: (text: string, params?: unknown[]) => Promise<unknown[]>) => Promise<unknown>) =>
      fn(async (text, params) => {
        onQuery?.(text, params);
        return [];
      }),
    query: async () => [],
  } as never;
}
