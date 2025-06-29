import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export interface PickUpOrderRequest {
  order_id: string;
}

@Controller('agents')
export class AgentsController {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService
  ) {}

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
