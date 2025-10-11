import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export interface DeliveryTimeWindow {
  id: string;
  order_id: string;
  slot_id: string;
  preferred_date: string;
  time_slot_start: string;
  time_slot_end: string;
  is_confirmed: boolean;
  special_instructions?: string;
  confirmed_at?: string;
  confirmed_by?: string;
  created_at: string;
  updated_at: string;
  slot?: {
    id: string;
    slot_name: string;
    slot_type: 'standard' | 'fast';
    start_time: string;
    end_time: string;
  };
}

export interface CreateDeliveryWindowDto {
  order_id: string;
  slot_id: string;
  preferred_date: string;
  special_instructions?: string;
}

export interface UpdateDeliveryWindowDto {
  slot_id?: string;
  preferred_date?: string;
  special_instructions?: string;
}

@Injectable()
export class DeliveryWindowsService {
  private readonly logger = new Logger(DeliveryWindowsService.name);

  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  /**
   * Create a delivery time window for an order
   */
  async createDeliveryWindow(data: CreateDeliveryWindowDto): Promise<DeliveryTimeWindow> {
    try {
      // First, get slot details to populate time_slot_start and time_slot_end
      const slotQuery = `
        query GetSlotDetails($slot_id: uuid!) {
          delivery_time_slots_by_pk(id: $slot_id) {
            id
            slot_name
            slot_type
            start_time
            end_time
          }
        }
      `;

      const slotResponse = await this.hasuraSystemService.executeQuery(slotQuery, {
        slot_id: data.slot_id,
      });

      const slot = slotResponse.delivery_time_slots_by_pk;
      if (!slot) {
        throw new Error('Delivery slot not found');
      }

      // Create the delivery window
      const createQuery = `
        mutation CreateDeliveryWindow($object: delivery_time_windows_insert_input!) {
          insert_delivery_time_windows_one(object: $object) {
            id
            order_id
            slot_id
            preferred_date
            time_slot_start
            time_slot_end
            is_confirmed
            special_instructions
            confirmed_at
            confirmed_by
            created_at
            updated_at
          }
        }
      `;

      const createResponse = await this.hasuraSystemService.executeQuery(createQuery, {
        object: {
          order_id: data.order_id,
          slot_id: data.slot_id,
          preferred_date: data.preferred_date,
          time_slot_start: slot.start_time,
          time_slot_end: slot.end_time,
          special_instructions: data.special_instructions,
        },
      });

      const deliveryWindow = createResponse.insert_delivery_time_windows_one;
      if (!deliveryWindow) {
        throw new Error('Failed to create delivery window');
      }

      return {
        ...deliveryWindow,
        slot: {
          id: slot.id,
          slot_name: slot.slot_name,
          slot_type: slot.slot_type,
          start_time: slot.start_time,
          end_time: slot.end_time,
        },
      };
    } catch (error) {
      this.logger.error('Failed to create delivery window:', error);
      throw error;
    }
  }

  /**
   * Update a delivery time window
   */
  async updateDeliveryWindow(
    orderId: string,
    data: UpdateDeliveryWindowDto
  ): Promise<DeliveryTimeWindow> {
    try {
      const updateData: any = {};
      
      if (data.slot_id) {
        // Get new slot details
        const slotQuery = `
          query GetSlotDetails($slot_id: uuid!) {
            delivery_time_slots_by_pk(id: $slot_id) {
              id
              slot_name
              slot_type
              start_time
              end_time
            }
          }
        `;

        const slotResponse = await this.hasuraSystemService.executeQuery(slotQuery, {
          slot_id: data.slot_id,
        });

        const slot = slotResponse.delivery_time_slots_by_pk;
        if (!slot) {
          throw new Error('Delivery slot not found');
        }

        updateData.slot_id = data.slot_id;
        updateData.time_slot_start = slot.start_time;
        updateData.time_slot_end = slot.end_time;
      }

      if (data.preferred_date) {
        updateData.preferred_date = data.preferred_date;
      }

      if (data.special_instructions !== undefined) {
        updateData.special_instructions = data.special_instructions;
      }

      const updateQuery = `
        mutation UpdateDeliveryWindow($order_id: uuid!, $updates: delivery_time_windows_set_input!) {
          update_delivery_time_windows(
            where: { order_id: { _eq: $order_id } },
            _set: $updates
          ) {
            returning {
              id
              order_id
              slot_id
              preferred_date
              time_slot_start
              time_slot_end
              is_confirmed
              special_instructions
              confirmed_at
              confirmed_by
              created_at
              updated_at
            }
          }
        }
      `;

      const updateResponse = await this.hasuraSystemService.executeQuery(updateQuery, {
        order_id: orderId,
        updates: updateData,
      });

      const deliveryWindow = updateResponse.update_delivery_time_windows?.returning?.[0];
      if (!deliveryWindow) {
        throw new Error('Delivery window not found');
      }

      return deliveryWindow;
    } catch (error) {
      this.logger.error('Failed to update delivery window:', error);
      throw error;
    }
  }

  /**
   * Confirm a delivery time window (business only)
   */
  async confirmDeliveryWindow(orderId: string, confirmedBy: string): Promise<DeliveryTimeWindow> {
    try {
      const confirmQuery = `
        mutation ConfirmDeliveryWindow($order_id: uuid!, $confirmed_by: uuid!) {
          update_delivery_time_windows(
            where: { order_id: { _eq: $order_id } },
            _set: {
              is_confirmed: true,
              confirmed_at: "now()",
              confirmed_by: $confirmed_by
            }
          ) {
            returning {
              id
              order_id
              slot_id
              preferred_date
              time_slot_start
              time_slot_end
              is_confirmed
              special_instructions
              confirmed_at
              confirmed_by
              created_at
              updated_at
            }
          }
        }
      `;

      const confirmResponse = await this.hasuraSystemService.executeQuery(confirmQuery, {
        order_id: orderId,
        confirmed_by: confirmedBy,
      });

      const deliveryWindow = confirmResponse.update_delivery_time_windows?.returning?.[0];
      if (!deliveryWindow) {
        throw new Error('Delivery window not found');
      }

      return deliveryWindow;
    } catch (error) {
      this.logger.error('Failed to confirm delivery window:', error);
      throw error;
    }
  }

  /**
   * Get delivery time window for an order
   */
  async getDeliveryWindow(orderId: string): Promise<DeliveryTimeWindow | null> {
    try {
      const query = `
        query GetDeliveryWindow($order_id: uuid!) {
          delivery_time_windows(
            where: { order_id: { _eq: $order_id } },
            limit: 1
          ) {
            id
            order_id
            slot_id
            preferred_date
            time_slot_start
            time_slot_end
            is_confirmed
            special_instructions
            confirmed_at
            confirmed_by
            created_at
            updated_at
            slot: delivery_time_slots {
              id
              slot_name
              slot_type
              start_time
              end_time
            }
          }
        }
      `;

      const response = await this.hasuraSystemService.executeQuery(query, {
        order_id: orderId,
      });

      const deliveryWindow = response.delivery_time_windows?.[0];
      return deliveryWindow || null;
    } catch (error) {
      this.logger.error('Failed to get delivery window:', error);
      throw error;
    }
  }

  /**
   * Delete a delivery time window
   */
  async deleteDeliveryWindow(orderId: string): Promise<void> {
    try {
      const deleteQuery = `
        mutation DeleteDeliveryWindow($order_id: uuid!) {
          delete_delivery_time_windows(where: { order_id: { _eq: $order_id } }) {
            affected_rows
          }
        }
      `;

      await this.hasuraSystemService.executeQuery(deleteQuery, {
        order_id: orderId,
      });
    } catch (error) {
      this.logger.error('Failed to delete delivery window:', error);
      throw error;
    }
  }
}
