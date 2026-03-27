import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminAuthGuard } from './admin-auth.guard';
import { ApplicationSetupService } from './application-setup.service';
import { CountryOnboardingService } from './country-onboarding.service';
import type { CountryOnboardingConfigDto } from './dto/country-onboarding.dto';
import { RejectRentalListingDto } from './dto/rental-listing-moderation.dto';
import { AdminMessageService } from './admin-message.service';
import { AdminService } from './admin.service';
import { ApplicationSetupResponse } from './dto/application-setup.dto';
import { RentalListingModerationService } from './rental-listing-moderation.service';

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
    private readonly adminService: AdminService,
    private readonly rentalListingModerationService: RentalListingModerationService,
    private readonly applicationSetupService: ApplicationSetupService,
    private readonly countryOnboardingService: CountryOnboardingService
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

  @Get('rental-listings/moderation')
  @ApiOperation({
    summary: 'List rental location listings for moderation (pending by default)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'rejected', 'all'],
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'Paginated listings' })
  async listRentalListingsModeration(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const result = await this.rentalListingModerationService.listModerationQueue({
      status,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
    return { success: true, ...result };
  }

  @Post('rental-listings/:listingId/approve')
  @ApiOperation({ summary: 'Approve a pending rental listing (visible in public catalog)' })
  @ApiParam({ name: 'listingId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Listing approved' })
  @ApiResponse({ status: 400, description: 'Listing not pending' })
  async approveRentalListing(
    @Param('listingId') listingId: string,
    @Req() request: RequestWithUser
  ) {
    await this.rentalListingModerationService.approveListing(
      listingId,
      request.user.id
    );
    return { success: true };
  }

  @Post('rental-listings/:listingId/reject')
  @ApiOperation({
    summary: 'Reject a pending rental listing (requires reason; message + email to business)',
  })
  @ApiParam({ name: 'listingId', format: 'uuid' })
  @ApiBody({ type: RejectRentalListingDto })
  @ApiResponse({ status: 200, description: 'Listing rejected' })
  @ApiResponse({ status: 400, description: 'Invalid body or listing not pending' })
  async rejectRentalListing(
    @Param('listingId') listingId: string,
    @Body() body: RejectRentalListingDto,
    @Req() request: RequestWithUser
  ) {
    const reason = body.rejectionReason?.trim();
    if (!reason) {
      throw new HttpException(
        'rejectionReason is required',
        HttpStatus.BAD_REQUEST
      );
    }
    await this.rentalListingModerationService.rejectListing(
      listingId,
      request.user.id,
      reason
    );
    return { success: true };
  }

  @Get('agents')
  async getAgents(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('unverified') unverified?: string
  ) {
    try {
      const result = await this.adminService.getAgentsPaginated({
        page: Number(page) || 1,
        limit: Number(limit) || 10,
        search: search || '',
        unverifiedOnly: unverified === 'true',
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

  @Post('agents/:id/restore')
  @ApiOperation({
    summary: 'Restore suspended agent',
    description:
      'Set agent status back to active and record the restoration. Only for agents that were suspended (e.g. after 3 strikes in a month).',
  })
  @ApiParam({ name: 'id', description: 'Agent UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { reason: { type: 'string', description: 'Optional reason for restoration' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Agent restored' })
  async restoreAgent(
    @Param('id') agentId: string,
    @Body() body: { reason?: string },
    @Req() request: RequestWithUser
  ) {
    const result = await this.adminService.restoreAgent(
      agentId,
      request.user.id,
      body?.reason
    );
    if (!result.success) {
      throw new HttpException(
        result.error ?? 'Failed to restore agent',
        HttpStatus.BAD_REQUEST
      );
    }
    return { success: true, message: 'Agent restored to active' };
  }

  @Patch('agents/:id')
  async updateAgent(@Param('id') agentId: string, @Body() body: any) {
    try {
      const {
        first_name,
        last_name,
        phone_number,
        is_verified,
        vehicle_type_id,
      } = body || {};

      const userUpdates: {
        first_name?: string;
        last_name?: string;
        phone_number?: string;
      } = {};

      if (typeof first_name === 'string') userUpdates.first_name = first_name;
      if (typeof last_name === 'string') userUpdates.last_name = last_name;
      if (typeof phone_number === 'string')
        userUpdates.phone_number = phone_number;

      const agentUpdates: { is_verified?: boolean; vehicle_type_id?: string } =
        {};
      if (typeof is_verified === 'boolean') agentUpdates.is_verified = is_verified;
      if (typeof vehicle_type_id === 'string')
        agentUpdates.vehicle_type_id = vehicle_type_id;

      const result = await this.adminService.updateAgent(
        agentId,
        userUpdates,
        agentUpdates
      );

      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      console.error('Error updating agent:', error);
      return {
        success: false,
        error: error.message || 'Failed to update agent',
      };
    }
  }

  @Get('agents/:agentId/id-documents')
  async getAgentIdDocuments(@Param('agentId') agentId: string) {
    try {
      const result = await this.adminService.getAgentIdDocuments(agentId);
      return { success: true, ...result };
    } catch (error: any) {
      console.error('Error fetching agent ID documents:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch agent ID documents',
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

  @Patch('businesses/:id')
  @ApiOperation({
    summary: 'Update a business (admin only)',
    description:
      'Only business accounts with is_admin can update businesses. Supports name, is_admin, image_cleanup_enabled, and owner user fields.',
  })
  @ApiParam({ name: 'id', description: 'Business UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        is_admin: { type: 'boolean' },
        image_cleanup_enabled: { type: 'boolean' },
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        phone_number: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Business updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async updateBusiness(
    @Param('id') businessId: string,
    @Body()
    body: {
      name?: string;
      is_admin?: boolean;
      image_cleanup_enabled?: boolean;
      first_name?: string;
      last_name?: string;
      phone_number?: string;
    }
  ) {
    try {
      const userUpdates: {
        first_name?: string;
        last_name?: string;
        phone_number?: string;
      } = {};
      if (typeof body.first_name === 'string') userUpdates.first_name = body.first_name;
      if (typeof body.last_name === 'string') userUpdates.last_name = body.last_name;
      if (typeof body.phone_number === 'string')
        userUpdates.phone_number = body.phone_number;

      const businessUpdates: {
        name?: string;
        is_admin?: boolean;
        image_cleanup_enabled?: boolean;
      } = {};
      if (typeof body.name === 'string') businessUpdates.name = body.name;
      if (typeof body.is_admin === 'boolean') businessUpdates.is_admin = body.is_admin;
      if (typeof body.image_cleanup_enabled === 'boolean')
        businessUpdates.image_cleanup_enabled = body.image_cleanup_enabled;

      const result = await this.adminService.updateBusiness(
        businessId,
        userUpdates,
        businessUpdates
      );
      return { success: true, ...result };
    } catch (error: any) {
      console.error('Error updating business:', error);
      return {
        success: false,
        error: error.message || 'Failed to update business',
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

  @Get('application-setup')
  @ApiOperation({
    summary: 'Get application setup for a country',
    description:
      'Returns delivery configs, country delivery configs, cancellation fee configuration, and delivery time slots for the given country.',
  })
  @ApiQuery({
    name: 'countryCode',
    required: true,
    type: String,
    description: 'ISO 3166-1 alpha-2 country code (e.g. GA, CM)',
  })
  @ApiResponse({
    status: 200,
    description: 'Application setup data for the country',
  })
  @ApiResponse({
    status: 400,
    description: 'Missing or invalid country code',
  })
  async getApplicationSetup(
    @Query('countryCode') countryCode?: string
  ): Promise<{
    success: boolean;
    data?: ApplicationSetupResponse;
    error?: string;
  }> {
    if (!countryCode || countryCode.length !== 2) {
      return {
        success: false,
        error: 'countryCode is required and must be a 2-letter ISO code',
      };
    }

    try {
      const data = await this.applicationSetupService.getApplicationSetup(
        countryCode
      );
      return { success: true, data };
    } catch (error: any) {
      console.error('Error fetching application setup:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch application setup',
      };
    }
  }

  @Get('country-onboarding/:countryCode')
  @ApiOperation({
    summary: 'Get country onboarding configuration',
    description:
      'Returns delivery time slots, country delivery configs, and supported states for the given country.',
  })
  @ApiParam({
    name: 'countryCode',
    required: true,
    type: String,
    description: 'ISO 3166-1 alpha-2 country code (e.g. GA, CM)',
  })
  @ApiResponse({
    status: 200,
    description: 'Country onboarding configuration for the country',
  })
  @ApiResponse({
    status: 400,
    description: 'Missing or invalid country code',
  })
  async getCountryOnboardingConfig(
    @Param('countryCode') countryCode: string
  ): Promise<{
    success: boolean;
    data?: CountryOnboardingConfigDto;
    error?: string;
  }> {
    if (!countryCode || countryCode.length !== 2) {
      return {
        success: false,
        error: 'countryCode is required and must be a 2-letter ISO code',
      };
    }

    try {
      const data =
        await this.countryOnboardingService.getCountryOnboardingConfig(
          countryCode
        );
      return { success: true, data };
    } catch (error: any) {
      console.error('Error fetching country onboarding config:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch country onboarding config',
      };
    }
  }

  @Post('country-onboarding/apply')
  @ApiOperation({
    summary: 'Apply country onboarding configuration',
    description:
      'Replaces existing delivery time slots, country delivery configs, and supported states for the given country with the provided configuration.',
  })
  @ApiBody({
    description: 'Country onboarding configuration payload',
  })
  @ApiResponse({
    status: 200,
    description: 'Country onboarding configuration applied successfully',
  })
  async applyCountryOnboardingConfig(
    @Body() body: CountryOnboardingConfigDto
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.countryOnboardingService.applyCountryOnboardingConfig(body);
      return { success: true };
    } catch (error: any) {
      console.error('Error applying country onboarding config:', error);
      return {
        success: false,
        error: error.message || 'Failed to apply country onboarding config',
      };
    }
  }
}
