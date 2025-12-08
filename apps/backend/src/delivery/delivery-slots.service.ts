import { Injectable, Logger } from '@nestjs/common';
import { DateTime } from 'luxon';
import { DeliveryConfigService } from '../delivery-configs/delivery-configs.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export interface DeliveryTimeSlot {
  id: string;
  country_code: string;
  state?: string;
  slot_name: string;
  slot_type: 'standard' | 'fast';
  start_time: string;
  end_time: string;
  is_active: boolean;
  max_orders_per_slot: number;
  display_order: number;
}

export interface AvailableSlot extends DeliveryTimeSlot {
  available_capacity: number;
  is_available: boolean;
}

export interface SlotCapacity {
  slot_id: string;
  date: string;
  total_capacity: number;
  booked_count: number;
  available_capacity: number;
}

@Injectable()
export class DeliverySlotsService {
  private readonly logger = new Logger(DeliverySlotsService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly deliveryConfigService: DeliveryConfigService
  ) {}

  /**
   * Get available delivery time slots for a specific location and date
   * Optimized to batch capacity checks in a single query
   */
  async getAvailableSlots(
    countryCode: string,
    stateCode: string,
    date: string,
    isFastDelivery = false
  ): Promise<AvailableSlot[]> {
    try {
      const slotType = isFastDelivery ? 'fast' : 'standard';

      // First, get all slots for the location
      const slotsQuery = `
        query GetAvailableSlots($country_code: bpchar!, $state: String!, $slot_type: String!) {
          delivery_time_slots(
            where: {
              country_code: { _eq: $country_code },
              state: { _eq: $state },
              slot_type: { _eq: $slot_type },
              is_active: { _eq: true }
            },
            order_by: { display_order: asc }
          ) {
            id
            country_code
            state
            slot_name
            slot_type
            start_time
            end_time
            is_active
            max_orders_per_slot
            display_order
          }
        }
      `;

      const slotsResponse = await this.hasuraSystemService.executeQuery(
        slotsQuery,
        {
          country_code: countryCode,
          state: stateCode,
          slot_type: slotType,
        }
      );

      const slots = slotsResponse.delivery_time_slots || [];

      if (slots.length === 0) {
        return [];
      }

      // Batch capacity check: Get booking counts for all slots in a single query
      const slotIds = slots.map((slot: DeliveryTimeSlot) => slot.id);

      const capacityQuery = `
        query GetSlotCapacities($slot_ids: [uuid!]!, $date: date!) {
          delivery_time_slots(where: { id: { _in: $slot_ids } }) {
            id
            max_orders_per_slot
          }
          delivery_time_windows(
            where: {
              slot_id: { _in: $slot_ids },
              preferred_date: { _eq: $date }
            }
          ) {
            slot_id
          }
        }
      `;

      const capacityResponse = await this.hasuraSystemService.executeQuery(
        capacityQuery,
        {
          slot_ids: slotIds,
          date: date,
        }
      );

      // Create a map of slot capacities
      const slotCapacityMap = new Map<string, number>();
      (capacityResponse.delivery_time_slots || []).forEach((slot: any) => {
        slotCapacityMap.set(slot.id, slot.max_orders_per_slot || 0);
      });

      // Count bookings per slot
      const bookingCountMap = new Map<string, number>();
      (capacityResponse.delivery_time_windows || []).forEach((window: any) => {
        const slotId = window.slot_id;
        bookingCountMap.set(slotId, (bookingCountMap.get(slotId) || 0) + 1);
      });

      // Get timezone for the country
      const timezone =
        (await this.deliveryConfigService.getTimezone(countryCode)) ||
        'Africa/Libreville';

      // Get current time + 2 hours in UTC for comparison
      const twoHoursFromNow = DateTime.now()
        .plus({ hours: 2 })
        .toUTC()
        .toJSDate();

      // Calculate available capacity and time-based availability for each slot
      const slotsWithCapacity = await Promise.all(
        slots.map(async (slot: DeliveryTimeSlot) => {
          const totalCapacity =
            slotCapacityMap.get(slot.id) || slot.max_orders_per_slot || 0;
          const bookedCount = bookingCountMap.get(slot.id) || 0;
          const availableCapacity = Math.max(0, totalCapacity - bookedCount);

          // Check if slot is at least 2 hours in the future
          const isSlotInFuture = await this.isSlotAtLeast2HoursInFuture(
            date,
            slot.start_time,
            timezone,
            twoHoursFromNow
          );

          // Slot is available if there's capacity AND it's at least 2 hours in the future
          const isAvailable = availableCapacity > 0 && isSlotInFuture;

          return {
            ...slot,
            available_capacity: availableCapacity,
            is_available: isAvailable,
          };
        })
      );

      return slotsWithCapacity;
    } catch (error) {
      this.logger.error('Failed to get available slots:', error);
      throw error;
    }
  }

  /**
   * Check slot capacity for a specific date
   */
  async checkSlotCapacity(slotId: string, date: string): Promise<SlotCapacity> {
    try {
      const query = `
        query CheckSlotCapacity($slot_id: uuid!, $date: date!) {
          delivery_time_slots_by_pk(id: $slot_id) {
            id
            max_orders_per_slot
          }
          delivery_time_windows_aggregate(
            where: {
              slot_id: { _eq: $slot_id },
              preferred_date: { _eq: $date }
            }
          ) {
            aggregate {
              count
            }
          }
        }
      `;

      const response = await this.hasuraSystemService.executeQuery(query, {
        slot_id: slotId,
        date: date,
      });

      const slot = response.delivery_time_slots_by_pk;
      const bookedCount =
        response.delivery_time_windows_aggregate?.aggregate?.count || 0;
      const totalCapacity = slot?.max_orders_per_slot || 0;
      const availableCapacity = Math.max(0, totalCapacity - bookedCount);

      return {
        slot_id: slotId,
        date,
        total_capacity: totalCapacity,
        booked_count: bookedCount,
        available_capacity: availableCapacity,
      };
    } catch (error) {
      this.logger.error('Failed to check slot capacity:', error);
      throw error;
    }
  }

  /**
   * Get all delivery time slots for a location (for admin purposes)
   */
  async getAllSlots(
    countryCode: string,
    stateCode?: string
  ): Promise<DeliveryTimeSlot[]> {
    try {
      const whereClause: any = {
        country_code: { _eq: countryCode },
        ...(stateCode && { state: { _eq: stateCode } }),
      };

      const query = `
        query GetAllSlots($where: delivery_time_slots_bool_exp!) {
          delivery_time_slots(
            where: $where,
            order_by: [{ slot_type: asc }, { display_order: asc }]
          ) {
            id
            country_code
            state
            slot_name
            slot_type
            start_time
            end_time
            is_active
            max_orders_per_slot
            display_order
          }
        }
      `;

      const response = await this.hasuraSystemService.executeQuery(query, {
        where: whereClause,
      });

      return response.delivery_time_slots || [];
    } catch (error) {
      this.logger.error('Failed to get all slots:', error);
      throw error;
    }
  }

  /**
   * Get the next available delivery day (today or in the future)
   * Returns all available slots for the first day that has available slots, or null if none found
   */
  async getNextAvailableDay(
    countryCode: string,
    stateCode: string,
    isFastDelivery = false
  ): Promise<{ date: string; slots: AvailableSlot[] } | null> {
    try {
      const today = new Date();
      const maxDaysToCheck = 30; // Check up to 30 days in the future

      // Check each day starting from today
      for (let dayOffset = 0; dayOffset < maxDaysToCheck; dayOffset++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() + dayOffset);
        const dateStr = checkDate.toISOString().split('T')[0];

        // Get slots for this date
        const slots = await this.getAvailableSlots(
          countryCode,
          stateCode,
          dateStr,
          isFastDelivery
        );

        // Filter to only available slots (is_available === true and available_capacity > 0)
        const availableSlots = slots.filter(
          (slot) => slot.is_available && slot.available_capacity > 0
        );

        if (availableSlots.length > 0) {
          return {
            date: dateStr,
            slots: availableSlots,
          };
        }
      }

      // No available slots found within the search window
      return null;
    } catch (error) {
      this.logger.error('Failed to get next available day:', error);
      throw error;
    }
  }

  /**
   * Create a date-time in the specified timezone and convert it to UTC for comparison
   * @param date - Date string (YYYY-MM-DD)
   * @param time - Time string (HH:MM:SS or HH:MM)
   * @param timezone - IANA timezone identifier (e.g., 'Africa/Libreville')
   * @param twoHoursFromNow - Date object representing current time + 2 hours in UTC
   * @returns true if the slot is at least 2 hours in the future
   */
  private async isSlotAtLeast2HoursInFuture(
    date: string,
    time: string,
    timezone: string,
    twoHoursFromNow: Date
  ): Promise<boolean> {
    try {
      // Parse date string (YYYY-MM-DD)
      const [year, month, day] = date.split('-').map(Number);

      // Parse time string (HH:MM:SS or HH:MM)
      const timeParts = time.split(':');
      const hours = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1], 10);

      // Create a DateTime in the specified timezone with the given date and time
      const dateTimeInTimezone = DateTime.fromObject(
        {
          year,
          month,
          day,
          hour: hours,
          minute: minutes,
          second: 0,
        },
        { zone: timezone }
      );

      if (!dateTimeInTimezone.isValid) {
        this.logger.warn(
          `Invalid datetime created in timezone ${timezone}: ${dateTimeInTimezone.invalidReason}`
        );
        return false;
      }

      // Convert to UTC and compare with twoHoursFromNow
      const slotDateTimeUTC = dateTimeInTimezone.toUTC().toJSDate();

      // Slot is available if it's at least 2 hours in the future
      return slotDateTimeUTC >= twoHoursFromNow;
    } catch (error: any) {
      this.logger.error(
        `Error checking if slot is in future: ${error.message}`
      );
      return false;
    }
  }
}
