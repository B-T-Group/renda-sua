import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommissionsService } from '../commissions/commissions.service';
import type { Configuration } from '../config/configuration';
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
    special_instructions?: string;
  }>;
}

@Controller('agents')
export class AgentsController {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly commissionsService: CommissionsService,
    private readonly configService: ConfigService<Configuration>
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
      // Note: base_delivery_fee and per_km_delivery_fee are kept in query for commission calculation
      // subtotal is kept for agent_hold_amount calculation
      // but all financial fields will be removed in transformation. Financial fields like total_amount
      // and order item prices are excluded.
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
              quantity
              special_instructions
            }
          }
        }
      `;

      const result = await this.hasuraSystemService.executeQuery(query, {
        agentId,
      });

      // Transform orders to remove financial fields and add delivery_commission
      const orders = result.orders || [];

      // Get commission config and hold percentage once for all orders
      const commissionConfig =
        await this.commissionsService.getCommissionConfigs();
      const holdPercentage =
        this.configService.get('order')?.agentHoldPercentage || 80;

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

          // Calculate agent hold amount (needed to claim the order)
          const agentHoldAmount =
            order.subtotal !== undefined
              ? (order.subtotal * holdPercentage) / 100
              : 0;

          // Remove financial fields and add delivery_commission and agent_hold_amount
          const {
            base_delivery_fee: _base_delivery_fee,
            per_km_delivery_fee: _per_km_delivery_fee,
            subtotal: _subtotal,
            total_amount: _total_amount,
            order_holds: _order_holds,
            ...restOrder
          } = order;

          return {
            ...restOrder,
            delivery_commission: earnings.totalEarnings,
            agent_hold_amount: agentHoldAmount,
          };
        } catch (_error: any) {
          // Return original order if transformation fails (but this shouldn't happen)
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

  @Post('complete_onboarding')
  async completeOnboarding() {
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

      // Update the agent's onboarding_complete status
      const mutation = `
        mutation CompleteAgentOnboarding($agentId: uuid!) {
          update_agents_by_pk(
            pk_columns: { id: $agentId }
            _set: { 
              onboarding_complete: true,
              updated_at: "now()"
            }
          ) {
            id
            onboarding_complete
            updated_at
          }
        }
      `;

      const result = await this.hasuraSystemService.executeMutation(mutation, {
        agentId,
      });

      if (!result.update_agents_by_pk) {
        throw new HttpException(
          {
            success: false,
            error: 'Agent not found or could not be updated',
          },
          HttpStatus.NOT_FOUND
        );
      }

      return {
        success: true,
        agent: result.update_agents_by_pk,
        message: 'Onboarding completed successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to complete onboarding',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
