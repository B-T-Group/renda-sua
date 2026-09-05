import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraUserService } from '../hasura/hasura-user.service';
import type { FoodAvailabilitySlot } from './food-availability.util';
import { resolveFoodAvailability } from './food-availability.util';
import { isFoodCategoryName } from './food-item-availability.mapper';
import {
  findOverlappingSlots,
  findZeroLengthSlot,
} from './food-slot-validation.util';
import { timezoneFromAddressCountryCode } from '../users/user-timezone.util';

interface OwnedFoodTarget {
  itemId: string;
  locationId: string;
  timezone: string;
}

export interface FoodSettings {
  item_id: string;
  business_location_id: string;
  marked_unavailable_at: string | null;
  timezone: string;
  has_schedule: boolean;
  is_open_now: boolean;
  is_marked_unavailable_today: boolean;
  is_available_now: boolean;
  next_opening_at: string | null;
  slots: FoodAvailabilitySlot[];
}

const GET_ITEM_FOR_FOOD_SETTINGS = `
  query GetItemForFoodSettings($itemId: uuid!) {
    items_by_pk(id: $itemId) {
      id
      business_id
      item_sub_category {
        item_category { name }
      }
    }
  }
`;

const GET_LOCATION_FOR_FOOD_SETTINGS = `
  query GetLocationForFoodSettings($locationId: uuid!) {
    business_locations_by_pk(id: $locationId) {
      id
      business_id
      address { country }
    }
  }
`;

const GET_FOOD_SETTINGS = `
  query GetFoodSettings($itemId: uuid!, $locationId: uuid!) {
    food_item_settings(
      where: {
        item_id: { _eq: $itemId }
        business_location_id: { _eq: $locationId }
      }
    ) {
      id
      item_id
      business_location_id
      marked_unavailable_at
      availability_slots(order_by: [{ day_of_week: asc }, { start_time: asc }]) {
        id
        day_of_week
        start_time
        end_time
      }
    }
  }
`;

const INSERT_FOOD_SETTINGS = `
  mutation InsertFoodSettings($itemId: uuid!, $locationId: uuid!) {
    insert_food_item_settings_one(
      object: { item_id: $itemId, business_location_id: $locationId }
    ) {
      id
    }
  }
`;

const REPLACE_FOOD_SLOTS = `
  mutation ReplaceFoodSlots(
    $settingsId: uuid!
    $slots: [food_availability_slots_insert_input!]!
  ) {
    delete_food_availability_slots(
      where: { food_item_settings_id: { _eq: $settingsId } }
    ) {
      affected_rows
    }
    insert_food_availability_slots(objects: $slots) {
      affected_rows
    }
  }
`;

const SET_FOOD_MARKED_UNAVAILABLE = `
  mutation SetFoodMarkedUnavailable($settingsId: uuid!, $markedAt: timestamptz) {
    update_food_item_settings_by_pk(
      pk_columns: { id: $settingsId }
      _set: { marked_unavailable_at: $markedAt }
    ) {
      id
      marked_unavailable_at
    }
  }
`;

interface FoodSettingsRowResult {
  food_item_settings: Array<{
    id: string;
    item_id: string;
    business_location_id: string;
    marked_unavailable_at: string | null;
    availability_slots: Array<
      FoodAvailabilitySlot & { id: string }
    >;
  }>;
}

@Injectable()
export class FoodService {
  constructor(private readonly hasuraUserService: HasuraUserService) {}

  async getSettings(
    businessId: string,
    itemId: string,
    locationId: string
  ): Promise<FoodSettings> {
    const target = await this.assertOwnedFoodTarget(
      businessId,
      itemId,
      locationId
    );
    return this.readSettings(target);
  }

  /** Replaces the whole weekly schedule for one dish at one location. */
  async replaceAvailabilitySlots(
    businessId: string,
    itemId: string,
    locationId: string,
    slots: FoodAvailabilitySlot[]
  ): Promise<FoodSettings> {
    const target = await this.assertOwnedFoodTarget(
      businessId,
      itemId,
      locationId
    );
    this.assertValidSlots(slots);
    const settingsId = await this.ensureSettingsRow(itemId, locationId);
    await this.hasuraUserService.executeMutation(REPLACE_FOOD_SLOTS, {
      settingsId,
      slots: slots.map((slot) => ({
        food_item_settings_id: settingsId,
        day_of_week: slot.day_of_week,
        start_time: slot.start_time,
        end_time: slot.end_time,
      })),
    });
    return this.readSettings(target);
  }

  /** One-tap sold out / back on the menu for the rest of the local day. */
  async setAvailableToday(
    businessId: string,
    itemId: string,
    locationId: string,
    available: boolean
  ): Promise<FoodSettings> {
    const target = await this.assertOwnedFoodTarget(
      businessId,
      itemId,
      locationId
    );
    const settingsId = await this.ensureSettingsRow(itemId, locationId);
    await this.hasuraUserService.executeMutation(SET_FOOD_MARKED_UNAVAILABLE, {
      settingsId,
      markedAt: available ? null : new Date().toISOString(),
    });
    return this.readSettings(target);
  }

  private assertValidSlots(slots: FoodAvailabilitySlot[]): void {
    if (findZeroLengthSlot(slots)) {
      throw new HttpException(
        {
          success: false,
          error: 'A serving window cannot start and end at the same time',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    if (findOverlappingSlots(slots)) {
      throw new HttpException(
        { success: false, error: 'Serving windows cannot overlap' },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async readSettings(target: OwnedFoodTarget): Promise<FoodSettings> {
    const result =
      await this.hasuraUserService.executeQuery<FoodSettingsRowResult>(
        GET_FOOD_SETTINGS,
        { itemId: target.itemId, locationId: target.locationId }
      );
    const row = result.food_item_settings?.[0];
    const slots = (row?.availability_slots ?? []).map(
      ({ day_of_week, start_time, end_time }) => ({
        day_of_week,
        start_time,
        end_time,
      })
    );
    const availability = resolveFoodAvailability({
      slots,
      markedUnavailableAt: row?.marked_unavailable_at ?? null,
      now: new Date(),
      timezone: target.timezone,
    });
    return {
      item_id: target.itemId,
      business_location_id: target.locationId,
      marked_unavailable_at: row?.marked_unavailable_at ?? null,
      timezone: target.timezone,
      has_schedule: availability.hasSchedule,
      is_open_now: availability.isOpenNow,
      is_marked_unavailable_today: availability.isMarkedUnavailableToday,
      is_available_now: availability.isAvailableNow,
      next_opening_at: availability.nextOpeningAt?.toISOString() ?? null,
      slots,
    };
  }

  private async ensureSettingsRow(
    itemId: string,
    locationId: string
  ): Promise<string> {
    const existing =
      await this.hasuraUserService.executeQuery<FoodSettingsRowResult>(
        GET_FOOD_SETTINGS,
        { itemId, locationId }
      );
    const found = existing.food_item_settings?.[0]?.id;
    if (found) return found;

    const created = await this.hasuraUserService.executeMutation<{
      insert_food_item_settings_one: { id: string } | null;
    }>(INSERT_FOOD_SETTINGS, { itemId, locationId });
    const createdId = created.insert_food_item_settings_one?.id;
    if (!createdId) {
      throw new HttpException(
        { success: false, error: 'Could not create food settings' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    return createdId;
  }

  private async assertOwnedFoodTarget(
    businessId: string,
    itemId: string,
    locationId: string
  ): Promise<OwnedFoodTarget> {
    const item = await this.hasuraUserService.executeQuery<{
      items_by_pk: {
        business_id: string;
        item_sub_category?: {
          item_category?: { name?: string | null } | null;
        } | null;
      } | null;
    }>(GET_ITEM_FOR_FOOD_SETTINGS, { itemId });
    const itemRow = item.items_by_pk;
    if (!itemRow || itemRow.business_id !== businessId) {
      throw new HttpException(
        { success: false, error: 'Item not found' },
        HttpStatus.NOT_FOUND
      );
    }
    if (!isFoodCategoryName(itemRow.item_sub_category?.item_category?.name)) {
      throw new HttpException(
        { success: false, error: 'Item is not a food item' },
        HttpStatus.BAD_REQUEST
      );
    }

    const location = await this.hasuraUserService.executeQuery<{
      business_locations_by_pk: {
        business_id: string;
        address?: { country?: string | null } | null;
      } | null;
    }>(GET_LOCATION_FOR_FOOD_SETTINGS, { locationId });
    const locationRow = location.business_locations_by_pk;
    if (!locationRow || locationRow.business_id !== businessId) {
      throw new HttpException(
        { success: false, error: 'Location not found' },
        HttpStatus.NOT_FOUND
      );
    }

    return {
      itemId,
      locationId,
      timezone: timezoneFromAddressCountryCode(
        locationRow.address?.country ?? ''
      ),
    };
  }
}
