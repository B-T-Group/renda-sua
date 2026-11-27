import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { CreateProductInterestDto } from './dto/create-product-interest.dto';
import { ProductInterestService } from './product-interest.service';

@ApiTags('product-interest')
@Controller('product-interest')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class ProductInterestController {
  constructor(
    private readonly productInterestService: ProductInterestService,
    private readonly hasuraUserService: HasuraUserService
  ) {}

  @Post()
  @ApiOperation({ summary: 'Submit interest in an interest-only catalog listing' })
  @ApiBody({ type: CreateProductInterestDto })
  @ApiResponse({
    status: 201,
    description:
      'Interest submitted. When export orders are enabled for the market (countryCode, default CM) the response is an export order (`export_order: true`, `status`, `bc_number`); otherwise a lead-only interest row.',
    schema: {
      example: {
        success: true,
        data: {
          id: 'uuid',
          created_at: '2026-11-27T15:00:00.000Z',
          status: 'SUBMITTED',
          export_order: true,
          bc_number: 'BC-2026-0001',
        },
        message: 'Interest submitted successfully',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid listing or duplicate' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Body() dto: CreateProductInterestDto,
    @ReqContext() ctx: RequestContext
  ) {
    this.requireUserId(ctx);
    try {
      const data = await this.productInterestService.createInterest(dto);
      return {
        success: true,
        data,
        message: 'Interest submitted successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          success: false,
          message: error?.message || 'Failed to submit interest',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('client')
  @ApiOperation({ summary: 'List current client interest submissions' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listClient(
    @ReqContext() ctx: RequestContext,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    this.requireUserId(ctx);
    try {
      const data = await this.productInterestService.listForClient(
        page ? Number(page) : 1,
        limit ? Number(limit) : 20
      );
      return { success: true, data, message: 'Interest submissions retrieved' };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          success: false,
          message: error?.message || 'Failed to list interest submissions',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('business')
  @ApiOperation({ summary: 'List interest leads for the current business' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'locationId', required: false, type: String })
  async listBusiness(
    @ReqContext() ctx: RequestContext,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('locationId') locationId?: string
  ) {
    this.requireUserId(ctx);
    try {
      const data = await this.productInterestService.listForBusiness(
        page ? Number(page) : 1,
        limit ? Number(limit) : 20,
        locationId
      );
      return { success: true, data, message: 'Interest leads retrieved' };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          success: false,
          message: error?.message || 'Failed to list interest leads',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private requireUserId(ctx: RequestContext): string {
    const userId = this.hasuraUserService.getUserId(ctx);
    if (!userId || userId === 'anonymous') {
      throw new UnauthorizedException();
    }
    return userId;
  }
}
