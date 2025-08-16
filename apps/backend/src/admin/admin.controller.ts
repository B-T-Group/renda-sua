import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { BusinessAdminGuard } from './business-admin.guard';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { PermissionService } from '../auth/permission.service';

export interface AdminMessageRequest {
  entity_type: string;
  entity_id: string;
  message: string;
}

export interface AdminMessageResponse {
  success: boolean;
  message_id?: string;
  error?: string;
}

@Controller('admin')
@UseGuards(BusinessAdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly hasuraUserService: HasuraUserService,
    private readonly permissionService: PermissionService,
  ) {}

  @Get('agents')
  async getAgents(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string
  ) {
    const result = await this.adminService.getAgentsPaginated({
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      search: search || '',
    });
    return { success: true, ...result };
  }

  @Get('clients')
  async getClients(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string
  ) {
    const result = await this.adminService.getClientsPaginated({
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      search: search || '',
    });
    return { success: true, ...result };
  }

  @Get('businesses')
  async getBusinesses(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string
  ) {
    const result = await this.adminService.getBusinessesPaginated({
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      search: search || '',
    });
    return { success: true, ...result };
  }

  @Patch('agents/:id')
  async patchAgent(
    @Param('id') id: string,
    @Body()
    body: {
      first_name?: string;
      last_name?: string;
      phone_number?: string;
      is_verified?: boolean;
      vehicle_type_id?: string;
      [key: string]: unknown;
    }
  ) {
    const { userUpdates, agentUpdates } = this.splitAgentUpdates(body);
    if (
      Object.keys(userUpdates).length === 0 &&
      Object.keys(agentUpdates).length === 0
    ) {
      throw new BadRequestException('No valid fields to update');
    }
    const result = await this.adminService.updateAgent(
      id,
      userUpdates,
      agentUpdates
    );
    return { success: true, ...result };
  }

  @Patch('clients/:id')
  async patchClient(
    @Param('id') id: string,
    @Body()
    body: {
      first_name?: string;
      last_name?: string;
      phone_number?: string;
      [key: string]: unknown;
    }
  ) {
    const updates = this.pickAllowed(body);
    const user = await this.adminService.updateClientUser(id, updates);
    return { success: true, user };
  }

  @Patch('businesses/:id')
  async patchBusiness(
    @Param('id') id: string,
    @Body()
    body: {
      first_name?: string;
      last_name?: string;
      phone_number?: string;
      name?: string;
      is_admin?: boolean;
      [key: string]: unknown;
    }
  ) {
    const { userUpdates, businessUpdates } = this.splitBusinessUpdates(body);
    if (
      Object.keys(userUpdates).length === 0 &&
      Object.keys(businessUpdates).length === 0
    ) {
      throw new BadRequestException('No valid fields to update');
    }
    const result = await this.adminService.updateBusiness(
      id,
      userUpdates,
      businessUpdates
    );
    return { success: true, ...result };
  }

  @Post('message')
  async postMessage(@Body() messageData: AdminMessageRequest): Promise<AdminMessageResponse> {
    try {
      // Get the current user from the request context
      const userId = this.hasuraUserService.getCurrentUserId();
      
      // Check if user is a business admin
      const isAdmin = await this.permissionService.isBusinessAdmin(userId);
      if (!isAdmin) {
        return {
          success: false,
          error: 'Access denied. Only business admins can post messages.',
        };
      }

      // Validate required fields
      if (!messageData.entity_type || !messageData.entity_id || !messageData.message) {
        return {
          success: false,
          error: 'Missing required fields: entity_type, entity_id, and message are required.',
        };
      }

      // Validate entity type exists
      const entityTypeQuery = `
        query GetEntityType($id: String!) {
          entity_types_by_pk(id: $id) {
            id
            comment
          }
        }
      `;

      const entityTypeResult = await this.hasuraUserService.executeQuery(
        entityTypeQuery,
        { id: messageData.entity_type }
      );

      if (!entityTypeResult.entity_types_by_pk) {
        return {
          success: false,
          error: `Invalid entity type: ${messageData.entity_type}`,
        };
      }

      // Create the message
      const createMessageMutation = `
        mutation CreateAdminMessage($user_id: uuid!, $entity_type: String!, $entity_id: uuid!, $message: String!) {
          insert_user_messages_one(object: {
            user_id: $user_id,
            entity_type: $entity_type,
            entity_id: $entity_id,
            message: $message
          }) {
            id
            user_id
            entity_type
            entity_id
            message
            created_at
          }
        }
      `;

      const result = await this.hasuraUserService.executeMutation(
        createMessageMutation,
        {
          user_id: userId,
          entity_type: messageData.entity_type,
          entity_id: messageData.entity_id,
          message: messageData.message,
        }
      );

      if (result.insert_user_messages_one) {
        return {
          success: true,
          message_id: result.insert_user_messages_one.id,
        };
      } else {
        return {
          success: false,
          error: 'Failed to create message',
        };
      }
    } catch (error) {
      console.error('Error posting admin message:', error);
      return {
        success: false,
        error: error.message || 'Internal server error',
      };
    }
  }

  private pickAllowed(body: Record<string, unknown>) {
    const allowed: any = {};
    if (typeof body.first_name === 'string')
      allowed.first_name = body.first_name;
    if (typeof body.last_name === 'string') allowed.last_name = body.last_name;
    if (typeof body.phone_number === 'string')
      allowed.phone_number = body.phone_number;
    if (Object.keys(allowed).length === 0) {
      throw new BadRequestException('No valid fields to update');
    }
    return allowed;
  }

  private splitAgentUpdates(body: Record<string, unknown>) {
    const userUpdates = this.pickAllowed(body);
    const agentUpdates: any = {};
    if (typeof body.is_verified === 'boolean')
      agentUpdates.is_verified = body.is_verified;
    if (typeof body.vehicle_type_id === 'string')
      agentUpdates.vehicle_type_id = body.vehicle_type_id;
    return { userUpdates, agentUpdates };
  }

  private splitBusinessUpdates(body: Record<string, unknown>) {
    const userUpdates = this.pickAllowed(body);
    const businessUpdates: any = {};
    if (typeof body.name === 'string') businessUpdates.name = body.name;
    if (typeof body.is_admin === 'boolean')
      businessUpdates.is_admin = body.is_admin;
    return { userUpdates, businessUpdates };
  }
}
