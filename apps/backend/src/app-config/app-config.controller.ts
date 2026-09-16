import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { AppConfigService } from './app-config.service';
import type { ClientFlags } from './client-flags.constants';

@ApiTags('app-config')
@Controller('app-config')
@Throttle({ short: { limit: 120, ttl: 60000 } })
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Public()
  @Get('client-flags')
  @ApiOperation({
    summary: 'Client-readable feature flags (allowlisted keys only)',
  })
  @ApiQuery({
    name: 'country',
    required: false,
    description: 'ISO 3166-1 alpha-2 country code for country-specific overrides',
  })
  @ApiResponse({
    status: 200,
    description: 'Boolean feature flags for mobile/web clients',
  })
  async getClientFlags(
    @Query('country') country?: string
  ): Promise<{ success: boolean; data: ClientFlags; message: string }> {
    const data = await this.appConfigService.getClientFlags(country);
    return {
      success: true,
      data,
      message: 'Client flags retrieved successfully',
    };
  }
}
