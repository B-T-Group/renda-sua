import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Body, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import {
  CreateRentalAvailabilitySubscriptionDto,
  RentalSearchQueryDto,
  RentalSuggestQueryDto,
  RentalTopCategoriesQueryDto,
} from './dto/rental-search.dto';
import { RentalAvailabilityService } from './rental-availability.service';
import { RentalSearchService } from './rental-search.service';

@ApiTags('rentals')
@Controller('rentals')
@Throttle({ short: { limit: 60, ttl: 60000 } })
@UsePipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }))
export class RentalSearchController {
  constructor(
    private readonly searchService: RentalSearchService,
    private readonly availability: RentalAvailabilityService
  ) {}

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Search rentals with date availability, available first' })
  @ApiResponse({ status: 200, description: 'Listings with availability and date totals' })
  async search(@Query() query: RentalSearchQueryDto) {
    const data = await this.searchService.search(query);
    return { success: true, data };
  }

  @Public()
  @Get('suggestions')
  @ApiOperation({ summary: 'Typeahead for rental titles and categories' })
  @ApiResponse({ status: 200, description: 'Suggestion rows' })
  async suggestions(@Query() query: RentalSuggestQueryDto) {
    const suggestions = await this.searchService.suggest(query);
    return { success: true, data: { suggestions } };
  }

  @Public()
  @Get('categories/top')
  @ApiOperation({ summary: 'Top rental categories by bookings, then listing count' })
  @ApiResponse({ status: 200, description: 'Ranked categories' })
  async topCategories(@Query() query: RentalTopCategoriesQueryDto) {
    const categories = await this.searchService.topCategories(query);
    return { success: true, data: { categories } };
  }

  @Post('availability-subscriptions')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Notify once when a matching rental is free for these dates' })
  @ApiResponse({ status: 201, description: 'Subscription created or existing active row returned' })
  async subscribe(@Body() body: CreateRentalAvailabilitySubscriptionDto) {
    const subscription = await this.availability.subscribe(body);
    return { success: true, data: { subscription } };
  }

  @Delete('availability-subscriptions/:id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cancel an availability subscription' })
  @ApiResponse({ status: 200, description: 'Cancelled' })
  async cancel(@Param('id') id: string) {
    return this.availability.cancel(id);
  }
}
