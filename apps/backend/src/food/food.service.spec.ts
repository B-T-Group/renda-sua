import { HttpException, HttpStatus } from '@nestjs/common';
import { FoodService } from './food.service';
import { FOOD_CATEGORY_NAME } from './food.constants';

const BUSINESS_ID = 'biz-1';
const ITEM_ID = 'item-1';
const LOCATION_ID = 'loc-1';
const SETTINGS_ID = 'settings-1';

const OWNED_FOOD_ITEM = {
  business_id: BUSINESS_ID,
  item_sub_category: { item_category: { name: FOOD_CATEGORY_NAME } },
};

const OWNED_LOCATION = {
  business_id: BUSINESS_ID,
  address: { country: 'CM' },
};

const MONDAY_LUNCH = {
  id: 'slot-1',
  day_of_week: 1,
  start_time: '12:30:00',
  end_time: '16:00:00',
};

function settingsRow(overrides: {
  id?: string;
  markedUnavailableAt?: string | null;
  slots?: typeof MONDAY_LUNCH[];
} = {}) {
  return {
    id: overrides.id ?? SETTINGS_ID,
    item_id: ITEM_ID,
    business_location_id: LOCATION_ID,
    marked_unavailable_at: overrides.markedUnavailableAt ?? null,
    availability_slots: overrides.slots ?? [MONDAY_LUNCH],
  };
}

async function expectHttpStatus(
  action: Promise<unknown>,
  status: HttpStatus,
  error: string
) {
  try {
    await action;
    throw new Error('expected HttpException');
  } catch (caught: any) {
    expect(caught).toBeInstanceOf(HttpException);
    expect(caught.getStatus()).toBe(status);
    expect(caught.getResponse()).toMatchObject({ error });
  }
}

type FoodServiceMocks = {
  item?: unknown;
  location?: unknown;
  settingsRows?: ReturnType<typeof settingsRow>[];
  insertId?: string | null;
};

function resolveFoodQuery(query: string, options?: FoodServiceMocks) {
  if (query.includes('GetItemForFoodSettings')) {
    return {
      items_by_pk: options && 'item' in options ? options.item : OWNED_FOOD_ITEM,
    };
  }
  if (query.includes('GetLocationForFoodSettings')) {
    return {
      business_locations_by_pk:
        options && 'location' in options ? options.location : OWNED_LOCATION,
    };
  }
  if (query.includes('GetFoodSettings')) {
    return { food_item_settings: options?.settingsRows ?? [settingsRow()] };
  }
  return {};
}

function resolveFoodMutation(query: string, options?: FoodServiceMocks) {
  if (!query.includes('InsertFoodSettings')) return { id: 'ok' };
  if (options?.insertId === null) return { insert_food_item_settings_one: null };
  return {
    insert_food_item_settings_one: { id: options?.insertId ?? 'new-settings' },
  };
}

describe('FoodService', () => {
  function createService(options?: FoodServiceMocks) {
    const executeQuery = jest.fn(async (query: string) =>
      resolveFoodQuery(query, options)
    );
    const executeMutation = jest.fn(async (query: string) =>
      resolveFoodMutation(query, options)
    );
    return {
      service: new FoodService({ executeQuery, executeMutation } as any),
      executeQuery,
      executeMutation,
    };
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-24T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects settings for an item owned by another business', async () => {
    const { service } = createService({
      item: { ...OWNED_FOOD_ITEM, business_id: 'other-biz' },
    });

    await expectHttpStatus(
      service.getSettings(BUSINESS_ID, ITEM_ID, LOCATION_ID),
      HttpStatus.NOT_FOUND,
      'Item not found'
    );
  });

  it('rejects grocery items that are not cooked food', async () => {
    const { service } = createService({
      item: {
        business_id: BUSINESS_ID,
        item_sub_category: { item_category: { name: 'Food & Beverages' } },
      },
    });

    await expectHttpStatus(
      service.getSettings(BUSINESS_ID, ITEM_ID, LOCATION_ID),
      HttpStatus.BAD_REQUEST,
      'Item is not a food item'
    );
  });

  it('rejects a location that belongs to another business', async () => {
    const { service } = createService({
      location: { ...OWNED_LOCATION, business_id: 'other-biz' },
    });

    await expectHttpStatus(
      service.getSettings(BUSINESS_ID, ITEM_ID, LOCATION_ID),
      HttpStatus.NOT_FOUND,
      'Location not found'
    );
  });

  it('rejects overlapping serving windows before writing slots', async () => {
    const { service, executeMutation } = createService();

    await expectHttpStatus(
      service.replaceAvailabilitySlots(BUSINESS_ID, ITEM_ID, LOCATION_ID, [
        { day_of_week: 1, start_time: '12:00:00', end_time: '14:00:00' },
        { day_of_week: 1, start_time: '13:00:00', end_time: '15:00:00' },
      ]),
      HttpStatus.BAD_REQUEST,
      'Serving windows cannot overlap'
    );
    expect(executeMutation).not.toHaveBeenCalled();
  });

  it('reuses an existing settings row instead of inserting another', async () => {
    const { service, executeMutation } = createService({
      settingsRows: [settingsRow()],
    });

    await service.setAvailableToday(BUSINESS_ID, ITEM_ID, LOCATION_ID, true);

    expect(
      executeMutation.mock.calls.some(([query]) =>
        String(query).includes('InsertFoodSettings')
      )
    ).toBe(false);
    expect(executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('SetFoodMarkedUnavailable'),
      { settingsId: SETTINGS_ID, markedAt: null }
    );
  });

  it('fails closed when the settings insert returns no id', async () => {
    const { service } = createService({
      settingsRows: [],
      insertId: null,
    });

    await expectHttpStatus(
      service.setAvailableToday(BUSINESS_ID, ITEM_ID, LOCATION_ID, false),
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Could not create food settings'
    );
  });

  it('writes a sold-out stamp without changing open hours', async () => {
    const { service, executeMutation } = createService({
      settingsRows: [
        settingsRow({ markedUnavailableAt: '2026-08-24T11:00:00.000Z' }),
      ],
    });

    await service.setAvailableToday(BUSINESS_ID, ITEM_ID, LOCATION_ID, false);

    expect(executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('SetFoodMarkedUnavailable'),
      { settingsId: SETTINGS_ID, markedAt: '2026-08-24T12:00:00.000Z' }
    );
  });

  it('exposes sold-out separately from a still-open serving window', async () => {
    const { service } = createService({
      settingsRows: [
        settingsRow({ markedUnavailableAt: '2026-08-24T11:00:00.000Z' }),
      ],
    });

    const actual = await service.getSettings(
      BUSINESS_ID,
      ITEM_ID,
      LOCATION_ID
    );

    expect(actual.timezone).toBe('Africa/Douala');
    expect(actual.has_schedule).toBe(true);
    expect(actual.is_open_now).toBe(true);
    expect(actual.is_marked_unavailable_today).toBe(true);
    expect(actual.is_available_now).toBe(false);
  });
});
