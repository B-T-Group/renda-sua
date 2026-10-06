import { HttpStatus } from '@nestjs/common';
import {
  assertNoshowWindowOpen,
  loadPickupNoshowClock,
  PICKUP_NOSHOW_CANCEL_HOURS_KEY,
  PICKUP_REMINDER_COOLDOWN_MS,
  reminderCoolingDown,
} from './pickup-noshow.logic';

const READY = '2026-10-04T10:00:00.000Z';
const OPENS = '2026-10-04T12:00:00.000Z';

function freeze(iso: string) {
  jest.spyOn(Date, 'now').mockReturnValue(new Date(iso).getTime());
}

function runner(rows: unknown, readyAt: string | null = READY) {
  const executeQuery = jest.fn(async (query: string) => {
    if (query.includes('PickupReadyAt')) {
      return {
        order_status_history: readyAt ? [{ created_at: readyAt }] : [],
      };
    }
    return { application_configurations: rows };
  });
  return { executeQuery };
}

function order(country: { country_code?: string | null; addressCountry?: string | null } = {}) {
  return {
    id: 'order-1',
    business_location: {
      country_code: country.country_code,
      address: { country: country.addressCountry },
    },
  };
}

describe('loadPickupNoshowClock', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens the window on the exact hour and keeps it shut one millisecond earlier', async () => {
    const hasura = runner([{ country_code: 'CM', number_value: 2 }]);
    const now = jest.spyOn(Date, 'now').mockReturnValue(new Date(OPENS).getTime());
    const open = await loadPickupNoshowClock(hasura, order({ country_code: 'cm' }), {
      warn: jest.fn(),
      error: jest.fn(),
    });
    expect(open).toEqual({
      hours: 2,
      readyAt: READY,
      opensAt: OPENS,
      canCancel: true,
    });

    now.mockReturnValue(new Date(OPENS).getTime() - 1);
    const closed = await loadPickupNoshowClock(hasura, order({ country_code: 'CM' }), {
      warn: jest.fn(),
      error: jest.fn(),
    });
    expect(closed.canCancel).toBe(false);
    expect(closed.opensAt).toBe(OPENS);
  });

  it('prefers the location country code over the address and uses that hour row', async () => {
    const executeQuery = jest.fn(async (query: string) => {
      if (query.includes('PickupReadyAt')) {
        return { order_status_history: [{ created_at: READY }] };
      }
      return {
        application_configurations: [
          { country_code: null, number_value: 2 },
          { country_code: 'GA', number_value: 4 },
          { country_code: 'CM', number_value: 6 },
        ],
      };
    });
    freeze(READY);
    const clock = await loadPickupNoshowClock(
      { executeQuery },
      order({ country_code: 'GA', addressCountry: 'Cameroon' }),
      { warn: jest.fn(), error: jest.fn() }
    );
    expect(clock.hours).toBe(4);
    expect(clock.canCancel).toBe(false);
    const hoursCall = executeQuery.mock.calls.find(([query]) =>
      String(query).includes('PickupNoshowHours')
    );
    expect(hoursCall?.[1]).toEqual({
      key: PICKUP_NOSHOW_CANCEL_HOURS_KEY,
      country: 'GA',
    });
    const readyCall = executeQuery.mock.calls.find(([query]) =>
      String(query).includes('PickupReadyAt')
    );
    expect(String(readyCall?.[0])).toContain('order_by: { created_at: asc }');
    expect(String(readyCall?.[0])).toContain('limit: 1');
    expect(String(readyCall?.[0])).toContain('ready_for_pickup');
  });

  it('reads a country name from the address when the code is missing', async () => {
    const hasura = runner([{ country_code: 'CM', number_value: 1 }]);
    freeze('2026-10-04T10:30:00.000Z');
    const clock = await loadPickupNoshowClock(
      hasura,
      order({ addressCountry: ' Cameroun ' }),
      { warn: jest.fn(), error: jest.fn() }
    );
    expect(clock.hours).toBe(1);
    expect(hasura.executeQuery.mock.calls[0][1]).toEqual({
      key: PICKUP_NOSHOW_CANCEL_HOURS_KEY,
      country: 'CM',
    });
    expect(clock.canCancel).toBe(false);
  });

  it('uses the global row when the country has none, and defaults to 2 hours when nothing is configured', async () => {
    freeze(READY);
    const warn = jest.fn();
    const global = runner([
      { country_code: 'GA', number_value: 8 },
      { country_code: null, number_value: 3 },
    ]);
    const fromGlobal = await loadPickupNoshowClock(global, order({ country_code: 'CM' }), {
      warn,
      error: jest.fn(),
    });
    expect(fromGlobal.hours).toBe(3);
    expect(warn).not.toHaveBeenCalled();

    const missing = runner([]);
    const fromDefault = await loadPickupNoshowClock(missing, order(), {
      warn,
      error: jest.fn(),
    });
    expect(fromDefault.hours).toBe(2);
    expect(fromDefault.canCancel).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('using 2'));
  });

  it('accepts 1 to 168 hours, rejects zero (N-8) and falls back to 2 for a null value', async () => {
    freeze(READY);
    const min = await loadPickupNoshowClock(
      runner([{ country_code: null, number_value: 1 }]),
      order(),
      { warn: jest.fn(), error: jest.fn() }
    );
    expect(min.hours).toBe(1);
    expect(min.canCancel).toBe(false);

    const max = await loadPickupNoshowClock(
      runner([{ country_code: null, number_value: '168' }]),
      order(),
      { warn: jest.fn(), error: jest.fn() }
    );
    expect(max.hours).toBe(168);
    expect(max.canCancel).toBe(false);

    const warn = jest.fn();
    const storedNull = await loadPickupNoshowClock(
      runner([{ country_code: null, number_value: null }]),
      order(),
      { warn, error: jest.fn() }
    );
    expect(storedNull.hours).toBe(2);
    expect(storedNull.canCancel).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('using 2'));

    for (const number_value of [0, '0', 0.5, -1, 169, 'nope', Number.NaN]) {
      await expect(
        loadPickupNoshowClock(runner([{ country_code: null, number_value }]), order(), {
          warn: jest.fn(),
          error: jest.fn(),
        })
      ).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'pickup_noshow_cancel_hours must be between 1 and 168',
      });
    }
  });

  it('refuses a cancel when the order has never been marked ready', async () => {
    freeze(OPENS);
    const logger = { warn: jest.fn(), error: jest.fn() };
    const missing = await loadPickupNoshowClock(
      runner([{ country_code: null, number_value: 2 }], null),
      order(),
      logger
    );
    expect(missing).toMatchObject({ readyAt: null, opensAt: null, canCancel: false });
    expect(() => assertNoshowWindowOpen(missing)).toThrow(/ready for 2 hours$/);

    const invalid = await loadPickupNoshowClock(
      runner([{ country_code: null, number_value: 2 }], 'not-a-date'),
      order(),
      logger
    );
    expect(invalid.canCancel).toBe(false);
    expect(() => assertNoshowWindowOpen(invalid)).toThrow(/ready for 2 hours$/);
  });

  it('names the opening time when the window is still closed', () => {
    expect(() =>
      assertNoshowWindowOpen({
        hours: 2,
        readyAt: READY,
        opensAt: OPENS,
        canCancel: false,
      })
    ).toThrow(`after ${OPENS}`);
    expect(() =>
      assertNoshowWindowOpen({
        hours: 2,
        readyAt: READY,
        opensAt: OPENS,
        canCancel: true,
      })
    ).not.toThrow();
  });
});

describe('reminderCoolingDown', () => {
  const now = new Date('2026-10-04T12:00:00.000Z').getTime();

  it('allows another reminder once the 30-minute cooldown has elapsed', () => {
    expect(reminderCoolingDown(null, now)).toBe(false);
    expect(reminderCoolingDown(undefined, now)).toBe(false);
    expect(reminderCoolingDown('', now)).toBe(false);
    expect(reminderCoolingDown('not-a-date', now)).toBe(false);
    expect(reminderCoolingDown(new Date(now - PICKUP_REMINDER_COOLDOWN_MS + 1).toISOString(), now)).toBe(
      true
    );
    expect(reminderCoolingDown(new Date(now - PICKUP_REMINDER_COOLDOWN_MS).toISOString(), now)).toBe(
      false
    );
    expect(reminderCoolingDown(new Date(now + 1000).toISOString(), now)).toBe(true);
  });
});
