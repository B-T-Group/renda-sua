import { Controller, Get, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { CatalogExperienceContextBuilder } from './catalog-experience.context';
import { CatalogExperienceService } from './catalog-experience.service';
import { CatalogExperienceQueryDto } from './dto/catalog-experience-query.dto';

@ApiTags('Catalog experience')
@Controller('catalog/experience')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class CatalogExperienceController {
  constructor(
    private readonly contextBuilder: CatalogExperienceContextBuilder,
    private readonly experience: CatalogExperienceService
  ) {}

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'All shopper categories in the current market' })
  @ApiQuery({ name: 'country_code', required: false, type: String })
  @ApiQuery({ name: 'state', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Categories with images and listing counts' })
  async listCategories(@Query() query: CatalogExperienceQueryDto) {
    const context = await this.contextBuilder.build(query);
    const categories = await this.experience.listCategories(context);
    return { success: true, data: { categories }, message: 'Catalog categories' };
  }

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Discovery modules for the shopper catalog home',
  })
  @ApiQuery({ name: 'country_code', required: false, type: String })
  @ApiQuery({ name: 'state', required: false, type: String })
  @ApiQuery({ name: 'language', required: false, type: String })
  @ApiQuery({ name: 'layout', required: false, enum: ['discovery', 'results'] })
  @ApiQuery({ name: 'device', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Ordered catalog modules' })
  async getExperience(@Query() query: CatalogExperienceQueryDto) {
    const context = await this.contextBuilder.build(query);
    const data = await this.experience.getExperience(context);
    return {
      success: true,
      data,
      message: 'Catalog experience',
    };
  }
}
