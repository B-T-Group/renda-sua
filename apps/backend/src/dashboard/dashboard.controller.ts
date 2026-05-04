import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import type { DashboardAggregatesDto } from './dashboard.service';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('aggregates')
  @ApiOperation({
    summary: 'Get dashboard aggregates',
    description:
      'Returns lightweight counts for orders (by status), pending cash-exception reconciliations, items, locations, inventory, failed deliveries. For business admins, also returns client count, agent (verified/unverified), business (verified/not verified) counts.',
  })
  @ApiResponse({ status: 200, description: 'Aggregates for the dashboard' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getAggregates(): Promise<{ success: true; data: DashboardAggregatesDto }> {
    try {
      const data = await this.dashboardService.getAggregates();
      return { success: true, data };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to fetch dashboard aggregates',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
