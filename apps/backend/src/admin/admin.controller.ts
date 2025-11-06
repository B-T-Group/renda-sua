import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminMessageService } from './admin-message.service';
import { AdminService } from './admin.service';

interface RequestWithUser extends Request {
  user: any;
}

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

@ApiTags('admin')
@Controller('admin')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(
    private readonly adminMessageService: AdminMessageService,
    private readonly adminService: AdminService
  ) {}

  @Post('message')
  async postMessage(
    @Body() messageData: AdminMessageRequest,
    @Req() request: RequestWithUser
  ): Promise<AdminMessageResponse> {
    try {
      // User is already authenticated and verified as admin by the guard
      const user = request.user;

      // Validate required fields
      if (
        !messageData.entity_type ||
        !messageData.entity_id ||
        !messageData.message
      ) {
        return {
          success: false,
          error:
            'Missing required fields: entity_type, entity_id, and message are required',
        };
      }

      // Validate entity type exists
      const entityTypeExists =
        await this.adminMessageService.validateEntityType(
          messageData.entity_type
        );
      if (!entityTypeExists) {
        return {
          success: false,
          error: `Invalid entity type: ${messageData.entity_type}`,
        };
      }

      // Create the message
      const messageId = await this.adminMessageService.createMessage(
        user.id,
        messageData.entity_type,
        messageData.entity_id,
        messageData.message
      );

      return {
        success: true,
        message_id: messageId,
      };
    } catch (error: any) {
      console.error('Error posting admin message:', error);
      return {
        success: false,
        error: error.message || 'Internal server error',
      };
    }
  }

  @Get('agents')
  async getAgents(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string
  ) {
    try {
      const result = await this.adminService.getAgentsPaginated({
        page: Number(page) || 1,
        limit: Number(limit) || 10,
        search: search || '',
      });
      return { success: true, ...result };
    } catch (error: any) {
      console.error('Error fetching agents:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch agents',
      };
    }
  }

  @Get('clients')
  async getClients(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string
  ) {
    try {
      const result = await this.adminService.getClientsPaginated({
        page: Number(page) || 1,
        limit: Number(limit) || 10,
        search: search || '',
      });
      return { success: true, ...result };
    } catch (error: any) {
      console.error('Error fetching clients:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch clients',
      };
    }
  }

  @Get('businesses')
  async getBusinesses(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string
  ) {
    try {
      const result = await this.adminService.getBusinessesPaginated({
        page: Number(page) || 1,
        limit: Number(limit) || 10,
        search: search || '',
      });
      return { success: true, ...result };
    } catch (error: any) {
      console.error('Error fetching businesses:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch businesses',
      };
    }
  }

  @Get('users/:id/uploads')
  async getUserUploads(
    @Param('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    try {
      const result = await this.adminService.getUserUploads({
        userId,
        page: Number(page) || 1,
        limit: Number(limit) || 10,
      });
      return { success: true, ...result };
    } catch (error: any) {
      console.error('Error fetching user uploads:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch user uploads',
      };
    }
  }

  @Get('users/:id/messages')
  async getUserMessages(
    @Param('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    try {
      const result = await this.adminService.getUserMessages({
        userId,
        page: Number(page) || 1,
        limit: Number(limit) || 10,
      });
      return { success: true, ...result };
    } catch (error: any) {
      console.error('Error fetching user messages:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch user messages',
      };
    }
  }

  @Get('users/:id')
  async getUserDetails(@Param('id') userId: string) {
    try {
      const result = await this.adminService.getUserDetails(userId);
      return { success: true, user: result };
    } catch (error: any) {
      console.error('Error fetching user details:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch user details',
      };
    }
  }

  @Get('commission-users')
  @ApiOperation({
    summary: 'Get commission users',
    description:
      'Retrieve all users that receive commissions (partners and company account hq@rendasua.com) with their accounts',
  })
  @ApiResponse({
    status: 200,
    description: 'List of commission users with accounts',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          identifier: { type: 'string' },
          email: { type: 'string', example: 'hq@rendasua.com' },
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          phone_number: { type: 'string' },
          user_type_id: { type: 'string', example: 'partner' },
          accounts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                currency: { type: 'string', example: 'XAF' },
                available_balance: { type: 'number' },
                withheld_balance: { type: 'number' },
                total_balance: { type: 'number' },
                is_active: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  })
  async getCommissionUsers() {
    try {
      const users = await this.adminService.getCommissionUsers();
      return { success: true, users };
    } catch (error: any) {
      console.error('Error fetching commission users:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch commission users',
      };
    }
  }

  @Get('accounts/:accountId/transactions')
  @ApiOperation({
    summary: 'Get account transactions',
    description:
      'Retrieve paginated transactions for a specific account by account ID',
  })
  @ApiParam({
    name: 'accountId',
    description: 'Account UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number (default: 1)',
    required: false,
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Items per page (default: 50)',
    required: false,
    type: Number,
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated account transactions',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        transactions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              account_id: { type: 'string', format: 'uuid' },
              amount: { type: 'number' },
              transaction_type: { type: 'string', example: 'deposit' },
              memo: { type: 'string' },
              reference_id: { type: 'string', format: 'uuid' },
              created_at: { type: 'string', format: 'date-time' },
              account: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  currency: { type: 'string' },
                  user_id: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' },
            hasNext: { type: 'boolean' },
            hasPrev: { type: 'boolean' },
          },
        },
      },
    },
  })
  async getAccountTransactions(
    @Param('accountId') accountId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    try {
      const result = await this.adminService.getAccountTransactions({
        accountId,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      return { success: true, ...result };
    } catch (error: any) {
      console.error('Error fetching account transactions:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch account transactions',
      };
    }
  }
}
