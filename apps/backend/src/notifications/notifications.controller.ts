import {
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { Public } from '../auth/public.decorator';
import type { Configuration } from '../config/configuration';
import { HasuraUserService } from '../hasura/hasura-user.service';
import type { NotificationData } from './notification-types';
import { NotificationsService } from './notifications.service';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';
import { NotificationPreferenceService } from './orchestration/notification-preference.service';
import type { PatchNotificationPreferencesDto } from './orchestration/notification.types';
import { WhatsAppChannel } from './orchestration/channels/whatsapp.channel';
import { WhatsAppTemplateService } from './orchestration/whatsapp-template.service';

interface RequestWithUser extends Request {
  user?: { sub?: string; id?: string };
}

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly hasuraUserService: HasuraUserService,
    private readonly configService: ConfigService<Configuration>,
    private readonly preferenceService: NotificationPreferenceService,
    private readonly whatsAppChannel: WhatsAppChannel,
    private readonly whatsAppTemplateService: WhatsAppTemplateService
  ) {}

  @Get('business-reachability')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Whether this business user can be reached for new orders (push + WhatsApp)',
  })
  @ApiResponse({ status: 200, description: 'Reachability flags' })
  async getBusinessReachability(@ReqContext() ctx: RequestContext) {
    const userId = this.hasuraUserService.getUserId(ctx);
    if (!userId || userId === 'anonymous') {
      throw new UnauthorizedException();
    }
    return this.notificationsService.getBusinessReachability(userId);
  }

  @Get('preferences')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get notification channel preferences for current user' })
  @ApiResponse({ status: 200, description: 'Preferences returned' })
  async getPreferences(@ReqContext() ctx: RequestContext) {
    const userId = this.hasuraUserService.getUserId(ctx);
    if (!userId || userId === 'anonymous') {
      throw new UnauthorizedException();
    }
    return this.preferenceService.getPreferences(userId);
  }

  @Patch('preferences')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update notification channel preferences' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        pushEnabled: { type: 'boolean' },
        emailEnabled: { type: 'boolean' },
        smsEnabled: { type: 'boolean' },
        whatsappEnabled: { type: 'boolean' },
        whatsappInformationalEnabled: { type: 'boolean' },
        marketingEnabled: { type: 'boolean' },
        orderUpdates: { type: 'boolean' },
        chat: { type: 'boolean' },
        marketplace: { type: 'boolean' },
        reminders: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Preferences updated' })
  @ApiResponse({ status: 400, description: 'WhatsApp opt-in requires verified phone' })
  async patchPreferences(
    @ReqContext() ctx: RequestContext,
    @Body() body: PatchNotificationPreferencesDto
  ) {
    const userId = this.hasuraUserService.getUserId(ctx);
    if (!userId || userId === 'anonymous') {
      throw new UnauthorizedException();
    }
    return this.preferenceService.patchPreferences(userId, body ?? {});
  }

  @Get('vapid-public-key')
  @ApiOperation({ summary: 'Get VAPID public key for push subscription' })
  @ApiResponse({ status: 200, description: 'VAPID public key' })
  vapidPublicKey() {
    return this.notificationsService.getVapidPublicKey();
  }

  @Post('push-subscribe')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Register push subscription for the current user' })
  @ApiResponse({ status: 200, description: 'Subscription saved' })
  @ApiResponse({ status: 400, description: 'Invalid subscription' })
  async pushSubscribe(
    @ReqContext() ctx: RequestContext,
    @Body()
    body: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    },
    @Req() request: RequestWithUser
  ) {
    const userId = this.hasuraUserService.getUserId(ctx);
    if (!userId || userId === 'anonymous') {
      return { success: false, error: 'Unauthorized' };
    }
    if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
      return { success: false, error: 'Invalid subscription payload' };
    }
    return this.notificationsService.savePushSubscription(userId, {
      endpoint: body.endpoint,
      keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
    });
  }

  @Post('push-token')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register Expo push token for the current user (mobile)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['expoPushToken'],
      properties: {
        expoPushToken: { type: 'string', description: 'Expo push token (ExponentPushToken[...])' },
        deviceId: { type: 'string', description: 'Optional device identifier for upsert' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Token saved or already registered' })
  @ApiResponse({ status: 400, description: 'Invalid or missing expoPushToken' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async registerPushToken(
    @ReqContext() ctx: RequestContext,
    @Body() body: { expoPushToken?: string; deviceId?: string },
    @Req() request: RequestWithUser
  ) {
    const userId = this.hasuraUserService.getUserId(ctx);
    if (!userId || userId === 'anonymous') {
      return { success: false, error: 'Unauthorized' };
    }
    if (!body?.expoPushToken || typeof body.expoPushToken !== 'string') {
      return { success: false, error: 'expoPushToken is required' };
    }
    return this.notificationsService.saveMobilePushToken(
      userId,
      body.expoPushToken
    );
  }

  @Get('push-token/status')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Check Expo push registration for the current user (any tokens; optional current device token)',
  })
  @ApiQuery({
    name: 'expoPushToken',
    required: false,
    description:
      'If set to the device Expo token, response includes currentTokenRegistered (true when already stored)',
  })
  @ApiResponse({
    status: 200,
    description: 'Registration flags and optional per-token match',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPushTokenStatus(@ReqContext() ctx: RequestContext, @Query('expoPushToken') expoPushToken: string | undefined) {
    const userId = this.hasuraUserService.getUserId(ctx);
    if (!userId || userId === 'anonymous') {
      return { success: false, error: 'Unauthorized' };
    }
    return this.notificationsService.getExpoPushRegistrationStatus(
      userId,
      expoPushToken
    );
  }

  @Post('test-push')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Send a test push notification to the current user' })
  @ApiResponse({
    status: 200,
    description: 'Test push sent or reason it was not sent',
  })
  async testPush(
    @ReqContext() ctx: RequestContext,
    @Body() body: { title?: string; body?: string },
    @Req() request: RequestWithUser
  ) {
    const userId = this.hasuraUserService.getUserId(ctx);
    if (!userId || userId === 'anonymous') {
      return { success: false, error: 'Unauthorized' };
    }
    const result = await this.notificationsService.sendTestPushNotification(
      userId,
      body?.title,
      body?.body
    );
    if (result.sent) {
      return {
        success: true,
        message:
          result.sentCount !== undefined
            ? `Test push sent to ${result.sentCount}/${result.subscriptionsCount} subscription(s)`
            : `Test push sent to ${result.subscriptionsCount} subscription(s)`,
        subscriptionsCount: result.subscriptionsCount,
        sentCount: result.sentCount,
        ...(result.error && { warning: result.error }),
      };
    }
    return {
      success: false,
      error: result.error,
      subscriptionsCount: result.subscriptionsCount,
      sentCount: result.sentCount ?? 0,
    };
  }

  @Post('test-order-created')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Test order creation notifications' })
  @ApiResponse({
    status: 200,
    description: 'Test notifications sent successfully',
  })
  async testOrderCreatedNotifications(@Body() data: NotificationData) {
    await this.notificationsService.sendOrderCreatedNotifications(data);
    return { success: true, message: 'Test notifications sent successfully' };
  }

  @Post('test-status-change')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Test order status change notifications' })
  @ApiResponse({
    status: 200,
    description: 'Test notifications sent successfully',
  })
  async testStatusChangeNotifications(
    @Body()
    data: {
      data: NotificationData;
      previousStatus: string;
      actorUserId?: string | null;
    }
  ) {
    await this.notificationsService.sendOrderStatusChangeNotifications(
      data.data,
      data.previousStatus,
      { actorUserId: data.actorUserId }
    );
    return { success: true, message: 'Test notifications sent successfully' };
  }

  @Public()
  @Post('internal/sms')
  @ApiOperation({
    summary: 'Internal: send SMS (trusted callers such as notify-agents Lambda)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['to', 'message'],
      properties: {
        to: { type: 'string', description: 'E.164 or local phone' },
        message: { type: 'string', description: 'SMS body (keep short)' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'SMS send attempted' })
  @ApiResponse({ status: 401, description: 'Invalid or missing internal key' })
  async internalSendSms(
    @Body() body: { to?: string; message?: string },
    @Headers('x-rendasua-internal-key') internalKey?: string
  ): Promise<{ success: boolean; error?: string }> {
    const expected =
      this.configService.get<Configuration['notificationsInternal']>(
        'notificationsInternal'
      )?.apiKey ?? '';
    if (!expected || internalKey !== expected) {
      throw new UnauthorizedException();
    }
    return this.notificationsService.sendInternalSms(body?.to ?? '', body?.message ?? '');
  }

  @Public()
  @Post('internal/push-by-user')
  @ApiOperation({
    summary:
      'Internal: send Expo + web push to a user by Hasura users.id (trusted callers e.g. notify-agents Lambda)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['userId', 'title', 'body'],
      properties: {
        userId: { type: 'string', format: 'uuid' },
        title: { type: 'string' },
        body: { type: 'string' },
        data: {
          type: 'object',
          additionalProperties: true,
          description: 'Optional payload; stringified for Expo Android',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Push send attempted' })
  @ApiResponse({ status: 401, description: 'Invalid or missing internal key' })
  async internalPushByUser(
    @Body()
    body: {
      userId?: string;
      title?: string;
      body?: string;
      data?: Record<string, unknown>;
    },
    @Headers('x-rendasua-internal-key') internalKey?: string
  ): Promise<{
    success: boolean;
    webSent?: number;
    expoSent?: number;
    error?: string;
  }> {
    const expected =
      this.configService.get<Configuration['notificationsInternal']>(
        'notificationsInternal'
      )?.apiKey ?? '';
    if (!expected || internalKey !== expected) {
      throw new UnauthorizedException();
    }
    return this.notificationsService.sendInternalPushByUserId(
      body?.userId ?? '',
      body?.title ?? '',
      body?.body ?? '',
      body?.data
    );
  }

  @Public()
  @Post('internal/whatsapp-template')
  @ApiOperation({
    summary: 'Internal: send WhatsApp template (ops / tests)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['to', 'templateKey'],
      properties: {
        to: { type: 'string' },
        templateKey: { type: 'string' },
        locale: { type: 'string' },
        variables: { type: 'object', additionalProperties: { type: 'string' } },
        ctaUrl: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'WhatsApp send attempted' })
  @ApiResponse({ status: 401, description: 'Invalid or missing internal key' })
  async internalWhatsAppTemplate(
    @Body()
    body: {
      to?: string;
      templateKey?: string;
      locale?: string;
      variables?: Record<string, string>;
      ctaUrl?: string;
    },
    @Headers('x-rendasua-internal-key') internalKey?: string
  ) {
    this.assertInternalKey(internalKey);
    return this.whatsAppChannel.send({
      to: body?.to ?? '',
      locale: body?.locale,
      payload: {
        templateKey: body?.templateKey ?? '',
        variables: body?.variables ?? {},
        ctaUrl: body?.ctaUrl,
      },
    });
  }

  @Get('whatsapp-templates')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List internal WhatsApp template catalog (dev/ops)' })
  listWhatsAppTemplates() {
    return {
      templates: this.whatsAppTemplateService.listTemplateCatalog(),
      configured: this.whatsAppChannel.isConfigured(),
    };
  }

  private assertInternalKey(internalKey?: string): void {
    const expected =
      this.configService.get<Configuration['notificationsInternal']>(
        'notificationsInternal'
      )?.apiKey ?? '';
    if (!expected || internalKey !== expected) {
      throw new UnauthorizedException();
    }
  }
}
