import { Module, forwardRef } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';

@Module({
  imports: [forwardRef(() => NotificationsModule)],
  controllers: [WhatsAppWebhookController],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
