import {
  Controller,
  Get,
  Param,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { StripeTaxCodesDatabaseService } from './stripe-tax-codes-database.service';
import { SearchStripeTaxCodesQueryDto } from './dto/search-stripe-tax-codes.dto';
import {
  StripeTaxCodeResponseDto,
  StripeTaxCodesListResponseDto,
} from './dto/stripe-tax-code.dto';

@ApiTags('stripe-tax')
@ApiBearerAuth()
@Controller('stripe-tax')
export class StripeTaxController {
  constructor(private readonly database: StripeTaxCodesDatabaseService) {}

  @Get('codes')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Search Stripe product tax categories' })
  @ApiResponse({ status: 200, type: StripeTaxCodesListResponseDto })
  async searchCodes(
    @Query() query: SearchStripeTaxCodesQueryDto
  ): Promise<StripeTaxCodesListResponseDto> {
    const limit = Number(query.limit ?? 50);
    const offset = Number(query.offset ?? 0);
    const { rows, total } = await this.database.search({
      search: query.search,
      group: query.group,
      limit,
      offset,
    });
    return {
      codes: rows.map((row) => this.database.toMerchantDto(row)),
      total,
      limit,
      offset,
    };
  }

  @Get('codes/:id')
  @ApiOperation({ summary: 'Get a single tax category by id' })
  @ApiResponse({ status: 200, type: StripeTaxCodeResponseDto })
  async getCode(@Param('id') id: string): Promise<StripeTaxCodeResponseDto> {
    const row = await this.database.getById(id);
    if (!row || !row.is_active) {
      return {
        id,
        name: id,
        description: null,
        groupName: null,
      };
    }
    return this.database.toMerchantDto(row);
  }
}
