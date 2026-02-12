import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type { BusinessAnalytics } from './analytics.service';
import { AnalyticsService } from './analytics.service';

interface RequestWithUser extends Request {
  user?: { sub?: string; id?: string };
}

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(AuthGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly hasuraSystemService: HasuraSystemService
  ) {}

  @Get('business')
  @ApiOperation({ summary: 'Get analytics for the current user business' })
  @ApiQuery({ name: 'startDate', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'endDate', required: false, description: 'ISO date' })
  @ApiResponse({ status: 200, description: 'Business analytics' })
  @ApiResponse({ status: 403, description: 'Not a business user' })
  async getBusinessAnalytics(
    @Req() request: RequestWithUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ): Promise<BusinessAnalytics> {
    const userIdentifier = request.user?.sub ?? request.user?.id;
    if (!userIdentifier) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const query = `
      query GetBusinessByUser($identifier: String!) {
        businesses(where: { user: { identifier: { _eq: $identifier } } }, limit: 1) {
          id
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      identifier: userIdentifier,
    });
    const businesses = (result?.businesses as { id: string }[]) ?? [];
    if (businesses.length === 0) {
      throw new HttpException(
        'Business not found for user',
        HttpStatus.FORBIDDEN
      );
    }
    const businessId = businesses[0].id;

    return this.analyticsService.getBusinessAnalytics(
      businessId,
      startDate,
      endDate
    );
  }
}
