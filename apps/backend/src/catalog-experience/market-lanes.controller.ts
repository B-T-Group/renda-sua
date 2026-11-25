import { Controller, Get, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { MarketLanesQueryDto } from './dto/market-lanes-query.dto';
import { MarketLanesService } from './market-lanes.service';

@ApiTags('Catalog market lanes')
@Controller('catalog/market-lanes')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class MarketLanesController {
  constructor(private readonly marketLanes: MarketLanesService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Which home browse lanes have inventory in a market',
  })
  @ApiQuery({ name: 'country_code', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Lane visibility flags and ordered visible lane ids',
  })
  async getMarketLanes(@Query() query: MarketLanesQueryDto) {
    const code = (query.country_code || '').trim().toUpperCase();
    if (code.length !== 2) {
      return {
        success: true,
        data: {
          country_code: code || '',
          lanes: {
            rentals: false,
            exports: false,
            shop: false,
            food: false,
          },
          visible: [],
        },
        message: 'Market lanes',
      };
    }
    const data = await this.marketLanes.getMarketLanes(code);
    return { success: true, data, message: 'Market lanes' };
  }
}
