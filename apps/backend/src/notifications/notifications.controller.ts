import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import type { NotificationData } from './notification-types';
import { NotificationsService } from './notifications.service';

interface RequestWithUser extends Request {
  user?: { sub?: string; id?: string };
}

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

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
    const userIdentifier = request.user?.sub ?? request.user?.id;
    if (!userIdentifier) {
      return { success: false, error: 'Unauthorized' };
    }
    if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
      return { success: false, error: 'Invalid subscription payload' };
    }
    return this.notificationsService.savePushSubscription(userIdentifier, {
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
    const userIdentifier = request.user?.sub ?? request.user?.id;
    if (!userIdentifier) {
      return { success: false, error: 'Unauthorized' };
    }
    if (!body?.expoPushToken || typeof body.expoPushToken !== 'string') {
      return { success: false, error: 'expoPushToken is required' };
    }
    return this.notificationsService.saveMobilePushToken(
      userIdentifier,
      body.expoPushToken
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
    const userIdentifier = request.user?.sub ?? request.user?.id;
    if (!userIdentifier) {
      return { success: false, error: 'Unauthorized' };
    }
    const result = await this.notificationsService.sendTestPushNotification(
      userIdentifier,
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
    @Body() data: { data: NotificationData; previousStatus: string }
  ) {
    await this.notificationsService.sendOrderStatusChangeNotifications(
      data.data,
      data.previousStatus
    );
    return { success: true, message: 'Test notifications sent successfully' };
  }
}
