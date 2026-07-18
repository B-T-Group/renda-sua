import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { RatingsService } from './ratings.service';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';

@ApiTags('ratings')
@Controller('ratings')
export class RatingsController {
  constructor(
    private readonly ratingsService: RatingsService,
    private readonly hasuraUserService: HasuraUserService
  ) {}

  @Get('order/:orderId')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get ratings for a specific order' })
  @ApiResponse({
    status: 200,
    description: 'Ratings retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Ratings retrieved successfully' },
        ratings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              order_id: { type: 'string', format: 'uuid' },
              rating_type: {
                type: 'string',
                enum: ['client_to_agent', 'client_to_item', 'agent_to_client'],
              },
              rater_user_id: { type: 'string', format: 'uuid' },
              rated_entity_type: {
                type: 'string',
                enum: ['agent', 'client', 'item'],
              },
              rated_entity_id: { type: 'string', format: 'uuid' },
              rating: { type: 'number', minimum: 1, maximum: 5 },
              comment: { type: 'string' },
              is_public: { type: 'boolean' },
              is_verified: { type: 'boolean' },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - Order not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Order not found' },
      },
    },
  })
  async getOrderRatings(@Param('orderId') orderId: string) {
    try {
      const ratings = await this.ratingsService.getRatingsForOrder(orderId);

      return {
        success: true,
        message: 'Ratings retrieved successfully',
        ratings,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to retrieve ratings',
        ratings: [],
      };
    }
  }

  @Get('order/:orderId/eligibility')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get the current user rating eligibility for an order',
  })
  @ApiResponse({
    status: 200,
    description: 'Eligibility retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        eligibility: {
          type: 'object',
          properties: {
            canRateAgent: { type: 'boolean' },
            canRateItem: { type: 'boolean' },
            canRateClient: { type: 'boolean' },
            itemRatingUnlocksAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            agentId: { type: 'string', format: 'uuid', nullable: true },
            clientId: { type: 'string', format: 'uuid', nullable: true },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  name: { type: 'string' },
                  rated: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Order or user profile not found' })
  async getOrderRatingEligibility(@ReqContext() ctx: RequestContext, @Param('orderId') orderId: string) {
    try {
      const userId = this.hasuraUserService.getUserId(ctx);
      const eligibility = await this.ratingsService.getOrderRatingEligibility(
        orderId,
        userId
      );
      return { success: true, eligibility };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to retrieve rating eligibility',
        eligibility: null,
      };
    }
  }

  @Public()
  @Get('aggregate/:entityType/:entityId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get the public rating aggregate for an entity (agent, client, item, ...)',
  })
  @ApiResponse({
    status: 200,
    description: 'Rating aggregate retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        aggregate: {
          type: 'object',
          nullable: true,
          properties: {
            entity_type: { type: 'string' },
            entity_id: { type: 'string', format: 'uuid' },
            total_ratings: { type: 'number' },
            average_rating: { type: 'number' },
            rating_1_count: { type: 'number' },
            rating_2_count: { type: 'number' },
            rating_3_count: { type: 'number' },
            rating_4_count: { type: 'number' },
            rating_5_count: { type: 'number' },
            last_rating_at: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
          },
        },
      },
    },
  })
  async getRatingAggregate(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string
  ) {
    try {
      const aggregate = await this.ratingsService.getRatingAggregate(
        entityType,
        entityId
      );
      return { success: true, aggregate };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to retrieve rating aggregate',
        aggregate: null,
      };
    }
  }

  @Get('rental-booking/:bookingId')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get ratings for a specific rental booking' })
  @ApiResponse({ status: 200, description: 'Ratings retrieved successfully' })
  async getRentalBookingRatings(@Param('bookingId') bookingId: string) {
    try {
      const ratings =
        await this.ratingsService.getRatingsForRentalBooking(bookingId);
      return {
        success: true,
        message: 'Ratings retrieved successfully',
        ratings,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to retrieve ratings',
        ratings: [],
      };
    }
  }

  @Public()
  @Get('entity/:entityType/:entityId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get public ratings for an entity (e.g. item)' })
  @ApiResponse({
    status: 200,
    description: 'Ratings retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Ratings retrieved successfully' },
        ratings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              order_id: { type: 'string', format: 'uuid' },
              rating_type: { type: 'string' },
              rater_user_id: { type: 'string', format: 'uuid' },
              rated_entity_type: { type: 'string' },
              rated_entity_id: { type: 'string', format: 'uuid' },
              rating: { type: 'number', minimum: 1, maximum: 5 },
              comment: { type: 'string' },
              is_public: { type: 'boolean' },
              is_verified: { type: 'boolean' },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  async getEntityRatings(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    try {
      const limitNum = limit ? parseInt(limit, 10) : 20;
      const offsetNum = offset ? parseInt(offset, 10) : 0;
      const ratings = await this.ratingsService.getRatingsForEntity(
        entityType,
        entityId,
        limitNum,
        offsetNum
      );

      return {
        success: true,
        message: 'Ratings retrieved successfully',
        ratings,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to retrieve ratings',
        ratings: [],
      };
    }
  }

  @Post()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new rating' })
  @ApiResponse({
    status: 201,
    description: 'Rating created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Rating created successfully' },
        rating: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            order_id: { type: 'string', format: 'uuid' },
            rating_type: {
              type: 'string',
              enum: ['client_to_agent', 'client_to_item', 'agent_to_client'],
            },
            rater_user_id: { type: 'string', format: 'uuid' },
            rated_entity_type: {
              type: 'string',
              enum: ['agent', 'client', 'item'],
            },
            rated_entity_id: { type: 'string', format: 'uuid' },
            rating: { type: 'number', minimum: 1, maximum: 5 },
            comment: { type: 'string' },
            is_public: { type: 'boolean' },
            is_verified: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid data or business rule violation',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Can only rate completed orders' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User not authorized to rate this order',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: {
          type: 'string',
          example: 'You are not authorized to rate this order',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - Order or entity not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Order not found' },
      },
    },
  })
  async createRating(
    @ReqContext() ctx: RequestContext,
    @Body() createRatingDto: CreateRatingDto,
    @Request() req: any
  ) {
    try {
      const userId = this.hasuraUserService.getUserId(ctx);
      const rating = await this.ratingsService.createRating(
        createRatingDto,
        userId
      );

      return {
        success: true,
        message: 'Rating created successfully',
        rating,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to create rating',
      };
    }
  }
}
