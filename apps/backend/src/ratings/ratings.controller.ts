import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateRatingDto } from './dto/create-rating.dto';
import { RatingsService } from './ratings.service';

@ApiTags('ratings')
@Controller('ratings')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post()
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
    @Body() createRatingDto: CreateRatingDto,
    @Request() req: any
  ) {
    try {
      const userIdentifier = req.user.sub; // Auth0 user ID
      const rating = await this.ratingsService.createRating(
        createRatingDto,
        userIdentifier
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
