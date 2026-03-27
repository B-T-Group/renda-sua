import {
    Controller,
    Get,
    HttpException,
    HttpStatus,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import type { BusinessAnalytics } from './analytics.service';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(AuthGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly hasuraUserService: HasuraUserService
  ) {}

  @Get('business')
  @ApiOperation({ summary: 'Get analytics for the current user business' })
  @ApiQuery({ name: 'startDate', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'endDate', required: false, description: 'ISO date' })
  @ApiResponse({ status: 200, description: 'Business analytics' })
  @ApiResponse({ status: 403, description: 'Not a business user' })
  async getBusinessAnalytics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ): Promise<BusinessAnalytics> {
    const userId = this.hasuraUserService.getUserId();
    if (!userId || userId === 'anonymous') {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const query = `
      query GetBusinessByUser($userId: uuid!) {
        businesses(where: { user_id: { _eq: $userId } }, limit: 1) {
          id
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      userId,
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
