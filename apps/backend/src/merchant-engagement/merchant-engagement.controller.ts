import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { MerchantEngagementService } from './merchant-engagement.service';

@ApiTags('merchant-engagement')
@Controller('business/engagement')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class MerchantEngagementController {
  constructor(private readonly engagement: MerchantEngagementService) {}

  @Get('tips-reminders')
  @ApiOperation({ summary: 'Get store tips & reminders preference' })
  @ApiResponse({ status: 200, description: 'Preference loaded' })
  async getPreference() {
    const data = await this.engagement.getTipsRemindersPreference();
    return { success: true, data };
  }

  @Patch('tips-reminders')
  @ApiOperation({ summary: 'Set store tips & reminders preference' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { tips_reminders_enabled: { type: 'boolean' } },
      required: ['tips_reminders_enabled'],
    },
  })
  @ApiResponse({ status: 200, description: 'Preference updated' })
  async setPreference(@Body() body: { tips_reminders_enabled?: boolean }) {
    if (typeof body?.tips_reminders_enabled !== 'boolean') {
      throw new BadRequestException('tips_reminders_enabled must be a boolean');
    }
    const data = await this.engagement.setTipsRemindersPreference(
      body.tips_reminders_enabled
    );
    return { success: true, data };
  }
}
