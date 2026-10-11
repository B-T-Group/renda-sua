import { Controller, Get, Patch, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

const GET_USER_RESTOCK_PREFERENCES = `
  query GetUserRestockPreferences($userId: uuid!) {
    user_notification_preferences(where: { user_id: { _eq: $userId } }) {
      restock_alerts_push_enabled
      restock_alerts_whatsapp_enabled
      restock_alerts_sms_enabled
    }
  }
`;

const UPDATE_RESTOCK_PREFERENCES = `
  mutation UpdateRestockPreferences(
    $userId: uuid!
    $pushEnabled: Boolean
    $whatsappEnabled: Boolean
    $smsEnabled: Boolean
  ) {
    update_user_notification_preferences(
      where: { user_id: { _eq: $userId } }
      _set: {
        restock_alerts_push_enabled: $pushEnabled
        restock_alerts_whatsapp_enabled: $whatsappEnabled
        restock_alerts_sms_enabled: $smsEnabled
      }
    ) {
      affected_rows
    }
  }
`;

const TOGGLE_ITEM_ALERT = `
  mutation ToggleItemAlert($userId: uuid!, $itemId: uuid!, $enabled: Boolean!) {
    update_restock_alerts(
      where: {
        user_id: { _eq: $userId }
        item_id: { _eq: $itemId }
      }
      _set: { alert_enabled: $enabled }
    ) {
      affected_rows
    }
  }
`;

class PatchRestockPreferencesDto {
  @IsOptional()
  @IsBoolean()
  restock_alerts_push_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  restock_alerts_whatsapp_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  restock_alerts_sms_enabled?: boolean;
}

class ToggleItemAlertDto {
  @IsUUID()
  item_id!: string;

  @IsBoolean()
  alert_enabled!: boolean;
}

@ApiTags('restock-alerts')
@Controller('restock-alerts')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class RestockAlertsController {
  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  @Get('preferences')
  @ApiOperation({ summary: 'Get user restock alert preferences' })
  @ApiResponse({
    status: 200,
    description: 'User preferences retrieved',
    schema: {
      type: 'object',
      properties: {
        restock_alerts_push_enabled: { type: 'boolean' },
        restock_alerts_whatsapp_enabled: { type: 'boolean' },
        restock_alerts_sms_enabled: { type: 'boolean' },
      },
    },
  })
  async getPreferences(@ReqContext() ctx: RequestContext) {
    const userId = ctx.userId;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    const result = await this.hasuraSystemService.executeQuery<{
      user_notification_preferences: Array<{
        restock_alerts_push_enabled: boolean;
        restock_alerts_whatsapp_enabled: boolean;
        restock_alerts_sms_enabled: boolean;
      }>;
    }>(GET_USER_RESTOCK_PREFERENCES, { userId });

    const prefs = result.user_notification_preferences[0] || {
      restock_alerts_push_enabled: true,
      restock_alerts_whatsapp_enabled: false,
      restock_alerts_sms_enabled: false,
    };

    return {
      restock_alerts_push_enabled: prefs.restock_alerts_push_enabled,
      restock_alerts_whatsapp_enabled: prefs.restock_alerts_whatsapp_enabled,
      restock_alerts_sms_enabled: prefs.restock_alerts_sms_enabled,
    };
  }

  @Patch('preferences')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user restock alert preferences' })
  @ApiResponse({
    status: 200,
    description: 'Preferences updated',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
      },
    },
  })
  async updatePreferences(
    @ReqContext() ctx: RequestContext,
    @Body() dto: PatchRestockPreferencesDto
  ) {
    const userId = ctx.userId;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    await this.hasuraSystemService.executeMutation(UPDATE_RESTOCK_PREFERENCES, {
      userId,
      pushEnabled: dto.restock_alerts_push_enabled,
      whatsappEnabled: dto.restock_alerts_whatsapp_enabled,
      smsEnabled: dto.restock_alerts_sms_enabled,
    });

    return { success: true };
  }

  @Patch('toggle-item-alert')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle restock alert for a specific item' })
  @ApiResponse({
    status: 200,
    description: 'Item alert toggled',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        alert_enabled: { type: 'boolean' },
      },
    },
  })
  async toggleItemAlert(
    @ReqContext() ctx: RequestContext,
    @Body() dto: ToggleItemAlertDto
  ) {
    const userId = ctx.userId;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    await this.hasuraSystemService.executeMutation(TOGGLE_ITEM_ALERT, {
      userId,
      itemId: dto.item_id,
      enabled: dto.alert_enabled,
    });

    return {
      success: true,
      alert_enabled: dto.alert_enabled,
    };
  }
}
