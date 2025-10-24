import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { CommissionsService } from '../commissions/commissions.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';

export interface PickUpOrderRequest {
  order_id: string;
}

export interface ActiveOrder {
  id: string;
  order_number: string;
  client_id: string;
  business_id: string;
  business_location_id: string;
  assigned_agent_id: string;
  delivery_address_id: string;
  subtotal: number;
  delivery_fee: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  current_status: string;
  estimated_delivery_time?: string;
  actual_delivery_time?: string;
  special_instructions?: string;
  preferred_delivery_time?: string;
  payment_method?: string;
  payment_status?: string;
  created_at: string;
  updated_at: string;
  client: {
    id: string;
    user: {
      id: string;
      first_name: string;
      last_name: string;
      email?: string;
    };
  };
  business: {
    id: string;
    name: string;
    user: {
      id: string;
      first_name: string;
      last_name: string;
      email?: string;
    };
  };
  business_location: {
    id: string;
    name: string;
    location_type: string;
    address: {
      id: string;
      address_line_1: string;
      address_line_2?: string;
      city: string;
      state: string;
      postal_code: string;
      country: string;
    };
  };
  delivery_address: {
    id: string;
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  order_items: Array<{
    id: string;
    item_name: string;
    item_description: string;
    unit_price: number;
    quantity: number;
    total_price: number;
    weight?: number;
    weight_unit?: string;
    dimensions?: string;
    special_instructions?: string;
  }>;
}

@Controller('agents')
export class AgentsController {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly commissionsService: CommissionsService
  ) {}

  @Get('active_orders')
  async getActiveOrders() {
    try {
      // Get the current agent's ID
      const user = await this.hasuraUserService.getUser();
      if (!user.agent) {
        throw new HttpException(
          {
            success: false,
            error: 'User is not an agent',
          },
          HttpStatus.FORBIDDEN
        );
      }

      const agentId = user.agent.id;

      // Query for active orders assigned to this agent
      const query = `
        query GetAgentActiveOrders($agentId: uuid!) {
          orders(
            where: {
              assigned_agent_id: { _eq: $agentId }
            }
            order_by: { created_at: desc }
          ) {
            id
            order_number
            client_id
            business_id
            business_location_id
            assigned_agent_id
            delivery_address_id
            subtotal
            base_delivery_fee
            per_km_delivery_fee
            tax_amount
            total_amount
            currency
            current_status
            estimated_delivery_time
            actual_delivery_time
            special_instructions
            preferred_delivery_time
            requires_fast_delivery
            payment_method
            payment_status
            created_at
            updated_at
            client {
              id
              user {
                id
                first_name
                last_name
                phone_number
                email
              }
            }
            business {
              id
              name
              is_admin
              is_verified
              user {
                id
                first_name
                last_name
                email
              }
            }
            verified_agent_delivery
            business_location {
              id
              name
              location_type
              address {
                id
                address_line_1
                address_line_2
                city
                state
                postal_code
                country
              }
            }
            delivery_address {
              id
              address_line_1
              address_line_2
              city
              state
              postal_code
              country
            }
            order_items {
              id
              item_name
              item_description
              unit_price
              quantity
              total_price
              weight
              weight_unit
              dimensions
              special_instructions
            }
          }
        }
      `;

      const result = await this.hasuraSystemService.executeQuery(query, {
        agentId,
      });

      // Transform orders to show agent commission amounts
      const orders = result.orders || [];

      // Get commission config once for all orders
      const commissionConfig =
        await this.commissionsService.getCommissionConfigs();

      const transformedOrders = orders.map((order: any) => {
        try {
          const earnings = this.commissionsService.calculateAgentEarningsSync(
            {
              id: order.id,
              base_delivery_fee: order.base_delivery_fee,
              per_km_delivery_fee: order.per_km_delivery_fee,
              currency: order.currency,
            },
            user.agent?.is_verified || false,
            commissionConfig
          );
          return {
            ...order,
            base_delivery_fee: earnings.baseDeliveryCommission,
            per_km_delivery_fee: earnings.perKmDeliveryCommission,
          };
        } catch (_error: any) {
          // Return original order if transformation fails
          return order;
        }
      });

      return {
        success: true,
        orders: transformedOrders,
        count: transformedOrders.length,
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to fetch active orders',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('pick_up_order')
  async pickUpOrder(@Body() request: PickUpOrderRequest) {
    try {
      const { order_id } = request;

      // Get the current agent's ID
      const user = await this.hasuraUserService.getUser();
      if (!user.agent) {
        throw new HttpException(
          {
            success: false,
            error: 'User is not an agent',
          },
          HttpStatus.FORBIDDEN
        );
      }

      const agentId = user.agent.id;

      // Update the order with the agent ID and status
      const mutation = `
        mutation PickUpOrder($order_id: uuid!, $agent_id: uuid!) {
          update_orders_by_pk(
            pk_columns: { id: $order_id }
            _set: { 
              assigned_agent_id: $agent_id,
              current_status: "assigned_to_agent",
              updated_at: "now()"
            }
          ) {
            id
            order_number
            current_status
            assigned_agent_id
            updated_at
          }
        }
      `;

      const result = await this.hasuraSystemService.executeMutation(mutation, {
        order_id,
        agent_id: agentId,
      });

      if (!result.update_orders_by_pk) {
        throw new HttpException(
          {
            success: false,
            error: 'Order not found or could not be updated',
          },
          HttpStatus.NOT_FOUND
        );
      }

      return {
        success: true,
        order: result.update_orders_by_pk,
        message: 'Order picked up successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to pick up order',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
