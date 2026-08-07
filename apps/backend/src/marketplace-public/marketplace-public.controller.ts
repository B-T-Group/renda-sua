import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { MarketplacePublicService } from './marketplace-public.service';
import type { MarketplacePublicStatsDto } from './marketplace-public.types';

@ApiTags('marketplace')
@Controller('marketplace')
@Throttle({ short: { limit: 60, ttl: 60000 } })
export class MarketplacePublicController {
  constructor(
    private readonly marketplacePublicService: MarketplacePublicService
  ) {}

  @Public()
  @Get('public-stats')
  @ApiOperation({
    summary:
      'Public marketplace trust metrics and merchant logos for marketing pages',
  })
  @ApiResponse({
    status: 200,
    description: 'Aggregate counts and locations with logos',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            merchants: { type: 'number' },
            products: { type: 'number' },
            cities: { type: 'number' },
            orders: { type: 'number' },
            setupMinutesMax: { type: 'number', example: 5 },
            securePaymentsPercent: { type: 'number', example: 100 },
            logos: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  logoUrl: { type: 'string' },
                },
              },
            },
          },
        },
        message: { type: 'string' },
      },
    },
  })
  async getPublicStats(): Promise<{
    success: boolean;
    data: MarketplacePublicStatsDto;
    message: string;
  }> {
    const data = await this.marketplacePublicService.getPublicStats();
    return {
      success: true,
      data,
      message: 'Marketplace public stats retrieved successfully',
    };
  }
}
