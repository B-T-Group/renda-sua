import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export interface DeliveryTimeSlot {
  id: string;
  country_code: string;
  state_code?: string;
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

  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  /**
   * Get available delivery time slots for a specific location and date
   */
  async getAvailableSlots(
    countryCode: string,
    stateCode: string,
    date: string,
    isFastDelivery: boolean = false
  ): Promise<AvailableSlot[]> {
    try {
      const slotType = isFastDelivery ? 'fast' : 'standard';
      
      const query = `
        query GetAvailableSlots($country_code: bpchar!, $state_code: String!, $slot_type: String!) {
          delivery_time_slots(
            where: {
              country_code: { _eq: $country_code },
              state_code: { _eq: $state_code },
              slot_type: { _eq: $slot_type },
              is_active: { _eq: true }
            },
            order_by: { display_order: asc }
          ) {
            id
            country_code
            state_code
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
        country_code: countryCode,
        state_code: stateCode,
        slot_type: slotType,
      });

      const slots = response.delivery_time_slots || [];

      // Get capacity information for each slot
      const slotsWithCapacity = await Promise.all(
        slots.map(async (slot: DeliveryTimeSlot) => {
          const capacity = await this.checkSlotCapacity(slot.id, date);
          return {
            ...slot,
            available_capacity: capacity.available_capacity,
            is_available: capacity.available_capacity > 0,
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
      const bookedCount = response.delivery_time_windows_aggregate?.aggregate?.count || 0;
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
  async getAllSlots(countryCode: string, stateCode?: string): Promise<DeliveryTimeSlot[]> {
    try {
      const whereClause: any = {
        country_code: { _eq: countryCode },
        ...(stateCode && { state_code: { _eq: stateCode } }),
      };

      const query = `
        query GetAllSlots($where: delivery_time_slots_bool_exp!) {
          delivery_time_slots(
            where: $where,
            order_by: [{ slot_type: asc }, { display_order: asc }]
          ) {
            id
            country_code
            state_code
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
}
