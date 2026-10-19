import { ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { DELEGATION_PERMISSIONS } from '../delegations/delegation.constants';
import { DelegationAccessService } from '../delegations/delegation-access.service';
import { GeoScopeService } from '../rbac/geo-scope.service';
import { PlatformPermissions } from '../rbac/platform-permissions';
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

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    @Optional() private readonly delegationAccess?: DelegationAccessService,
    @Optional() private readonly geoScope?: GeoScopeService
  ) {}

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
   * #594 DEV QA N3: who may confirm an order's delivery window (confirmed_by = caller):
   * - the owner of the order's business;
   * - a location delegate with an active grant on the order's business location
   *   (same business) holding orders.manage;
   * - a platform admin whose geo scope covers the order (platform.orders.cross_business).
   * 404 when the order does not exist, 403 otherwise.
   */
  async confirmDeliveryWindowAsBusiness(orderId: string, userId: string): Promise<DeliveryTimeWindow> {
    const res = await this.hasuraSystemService.executeQuery(
      `query DeliveryWindowOrderOwner($id: uuid!) {
        orders_by_pk(id: $id) { id business_id business_location_id business { user_id } }
      }`,
      { id: orderId }
    );
    const order = res?.orders_by_pk;
    if (!order) throw new NotFoundException('Order not found');
    if (!userId || !(await this.mayConfirm(order, userId))) {
      throw new ForbiddenException('Not allowed to confirm this order\'s delivery window');
    }
    return this.confirmDeliveryWindow(orderId, userId);
  }

  private async mayConfirm(
    order: { id: string; business_id: string; business_location_id: string; business?: { user_id?: string } },
    userId: string
  ): Promise<boolean> {
    if (order.business?.user_id === userId) return true;
    const grants = (await this.delegationAccess?.listActiveForUser(userId)) ?? [];
    const delegate = grants.some(
      (g) =>
        g.locationId === order.business_location_id &&
        g.businessId === order.business_id &&
        g.permissions.includes(DELEGATION_PERMISSIONS.ORDERS_MANAGE)
    );
    if (delegate) return true;
    return (await this.geoScope?.coversOrder(userId, PlatformPermissions.ORDERS_CROSS_BUSINESS, order.id)) === true;
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
