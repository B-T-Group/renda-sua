import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { DeliveryEstimateService } from './delivery-estimate.service';
import { DeliveryEstimateQueryDto } from './dto/delivery-estimate-query.dto';

@ApiTags('Delivery Estimate')
@Controller('delivery/estimate')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class DeliveryEstimateController {
  constructor(
    private readonly deliveryEstimateService: DeliveryEstimateService
  ) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Get delivery estimate for PDP and checkout',
    description:
      'Returns delivery window and fee estimate for a given market, area, category, seller, and SKU',
  })
  @ApiQuery({
    name: 'marketId',
    required: true,
    type: String,
    description: 'Market/country code (ISO 3166-1 alpha-2)',
    example: 'CM',
  })
  @ApiQuery({
    name: 'areaId',
    required: false,
    type: String,
    description: 'Area/state code within the market',
    example: 'Littoral',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    type: String,
    description: 'Product category',
    example: 'Electronics',
  })
  @ApiQuery({
    name: 'sellerId',
    required: false,
    type: String,
    description: 'Seller/business UUID',
    example: 'uuid',
  })
  @ApiQuery({
    name: 'skuId',
    required: false,
    type: String,
    description: 'Product SKU UUID',
    example: 'uuid',
  })
  @ApiQuery({
    name: 'qty',
    required: false,
    type: Number,
    description: 'Quantity',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Delivery estimate retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        areaLabel: {
          type: 'string',
          example: 'Cameroon · Douala (Littoral)',
        },
        needsFinerArea: {
          type: 'boolean',
          example: false,
        },
        window: {
          type: 'object',
          properties: {
            label: { type: 'string', example: 'Usually arrives' },
            band: { type: 'string', example: '24–48 hours' },
            start: { type: 'string', nullable: true, example: null },
            end: { type: 'string', nullable: true, example: null },
          },
        },
        fee: {
          type: 'object',
          properties: {
            currency: { type: 'string', example: 'XAF' },
            min: { type: 'number', example: 500 },
            max: { type: 'number', example: 1200 },
            exact: { type: 'number', nullable: true, example: null },
            confidence: { type: 'string', example: 'range' },
          },
        },
        servingStatus: {
          type: 'string',
          nullable: true,
          example: null,
        },
        coverage: {
          type: 'string',
          example: 'in',
        },
        trustVariant: {
          type: 'string',
          example: 'map_and_pin',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters',
  })
  @ApiResponse({
    status: 404,
    description: 'Market not found',
  })
  async getDeliveryEstimate(@Query() query: DeliveryEstimateQueryDto) {
    try {
      const estimate = await this.deliveryEstimateService.getEstimate({
        marketId: query.marketId,
        areaId: query.areaId,
        category: query.category,
        sellerId: query.sellerId,
        skuId: query.skuId,
        qty: query.qty,
      });

      return estimate;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      const message = error?.message || 'Failed to get delivery estimate';
      if (message.includes('not found')) {
        throw new HttpException(message, HttpStatus.NOT_FOUND);
      }

      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
