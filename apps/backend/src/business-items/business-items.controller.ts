import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { BusinessItemsService } from './business-items.service';

@ApiTags('business-items')
@Controller('business-items')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class BusinessItemsController {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly businessItemsService: BusinessItemsService
  ) {}

  @Get('items')
  @ApiOperation({ summary: 'Get items for the current business' })
  @ApiResponse({ status: 200, description: 'Items retrieved successfully' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  async getItems() {
    const user = await this.hasuraUserService.getUser();
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    const items = await this.businessItemsService.getItems(businessId);
    return { success: true, data: { items } };
  }

  @Get('locations')
  @ApiOperation({ summary: 'Get business locations for the current business' })
  @ApiResponse({ status: 200, description: 'Locations retrieved successfully' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  async getLocations() {
    const user = await this.hasuraUserService.getUser();
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    const business_locations =
      await this.businessItemsService.getBusinessLocations(businessId);
    return { success: true, data: { business_locations } };
  }

  @Get('available-items')
  @ApiOperation({
    summary: 'Get all active items from verified businesses',
  })
  @ApiResponse({ status: 200, description: 'Available items retrieved successfully' })
  async getAvailableItems() {
    const items = await this.businessItemsService.getAvailableItems();
    return { success: true, data: { items } };
  }
}
