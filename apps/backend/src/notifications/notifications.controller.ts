import {
  Body,
  Controller,
  Get,
  Headers,
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

interface RequestWithUser extends Request {
  user?: { sub?: string; id?: string };
}

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly hasuraUserService: HasuraUserService,
    private readonly configService: ConfigService<Configuration>
  ) {}

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
    @Body()
    body: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    },
    @Req() request: RequestWithUser
  ) {
    const userId = this.hasuraUserService.getUserId();
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
    @Body() body: { expoPushToken?: string; deviceId?: string },
    @Req() request: RequestWithUser
  ) {
    const userId = this.hasuraUserService.getUserId();
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
  async getPushTokenStatus(@Query('expoPushToken') expoPushToken: string | undefined) {
    const userId = this.hasuraUserService.getUserId();
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
    @Body() body: { title?: string; body?: string },
    @Req() request: RequestWithUser
  ) {
    const userId = this.hasuraUserService.getUserId();
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
}
