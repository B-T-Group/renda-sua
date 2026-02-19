import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { CsvUploadRequestDto } from './dto/csv-upload.dto';
import { BusinessItemsService } from './business-items.service';

const CSV_UPLOAD_ROW_LIMIT = 500;

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

  @Post('csv-upload')
  @ApiOperation({
    summary: 'Upload CSV rows to create/update items and inventory',
  })
  @ApiBody({ type: CsvUploadRequestDto })
  @ApiResponse({ status: 200, description: 'CSV processing result with inserted/updated/error counts' })
  @ApiResponse({ status: 400, description: 'Too many rows or invalid body' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  async csvUpload(@Body() body: CsvUploadRequestDto) {
    const user = await this.hasuraUserService.getUser();
    const businessId = user?.business?.id;
    const userId = user?.id;
    if (!businessId || !userId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    const rows = body?.rows ?? [];
    if (rows.length === 0) {
      return {
        success: true,
        data: {
          success: 0,
          inserted: 0,
          updated: 0,
          errors: 0,
          details: { inserted: [], updated: [], errors: [] },
        },
      };
    }
    if (rows.length > CSV_UPLOAD_ROW_LIMIT) {
      throw new HttpException(
        {
          success: false,
          error: `Too many rows. Maximum ${CSV_UPLOAD_ROW_LIMIT} allowed.`,
        },
        HttpStatus.BAD_REQUEST
      );
    }
    const data = await this.businessItemsService.processCsvRows(
      businessId,
      userId,
      rows
    );
    return { success: true, data };
  }
}
