import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import type {
  ActionsNeededDto,
  ClientCitiesDto,
  DashboardAggregatesDto,
} from './dashboard.service';
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

  @Get('actions')
  @ApiOperation({
    summary: 'Get actions needed for the current user',
    description:
      'Returns a prioritised list of actionable items for the current persona: AI suggestions, rejected items/rentals, pending orders, failed deliveries, cash reconciliation (business); available deliveries, active orders, verification (agent); pending orders, active delivery (client).',
  })
  @ApiResponse({
    status: 200,
    description: 'Ordered list of actions the user must take',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getActionsNeeded(): Promise<{ success: true; data: ActionsNeededDto }> {
    try {
      const data = await this.dashboardService.getActionsNeeded();
      return { success: true, data };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to fetch actions needed',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('client-cities')
  @ApiOperation({
    summary: 'Get client city frequencies for the business',
    description:
      'Returns a word-cloud-ready list of cities where unique clients who ordered or rented from this business are located.',
  })
  @ApiResponse({ status: 200, description: 'Client city frequencies' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getClientCities(): Promise<{ success: true; data: ClientCitiesDto }> {
    try {
      const data = await this.dashboardService.getClientCities();
      return { success: true, data };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to fetch client cities',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
