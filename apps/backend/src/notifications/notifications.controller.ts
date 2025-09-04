import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import type { NotificationData } from './notifications.service';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('test-order-created')
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
