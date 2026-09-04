import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AssistantModule } from '../assistant/assistant.module';
import { HasuraModule } from '../hasura/hasura.module';
import { RbacModule } from '../rbac/rbac.module';
import { SmsModule } from '../sms/sms.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { DeepLinkService } from './deep-link.service';
import { EmailChannel } from './orchestration/channels/email.channel';
import { PushChannel } from './orchestration/channels/push.channel';
import { SmsChannel } from './orchestration/channels/sms.channel';
import { WhatsAppChannel } from './orchestration/channels/whatsapp.channel';
import { NotificationActionTokenService } from './orchestration/notification-action-token.service';
import { NotificationAnalyticsService } from './orchestration/notification-analytics.service';
import { NotificationOrchestrator } from './orchestration/notification-orchestrator.service';
import { NotificationPolicyService } from './orchestration/notification-policy.service';
import { NotificationPreferenceService } from './orchestration/notification-preference.service';
import { WhatsAppInboundService } from './orchestration/whatsapp-inbound.service';
import { WhatsAppInboxPersistenceService } from './orchestration/whatsapp-inbox-persistence.service';
import { WhatsAppReplyService } from './orchestration/whatsapp-reply.service';
import { WhatsAppTemplateService } from './orchestration/whatsapp-template.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    ConfigModule,
    HasuraModule,
    SmsModule,
    RbacModule,
    forwardRef(() => AssistantModule),
    forwardRef(() => WhatsAppModule),
    // Lazy require avoids TDZ with OrdersModule <-> NotificationsModule cycle.
    forwardRef(() => require('../orders/orders.module').OrdersModule),
  ],
  providers: [
    NotificationsService,
    DeepLinkService,
    NotificationPreferenceService,
    NotificationAnalyticsService,
    NotificationPolicyService,
    WhatsAppTemplateService,
    PushChannel,
    EmailChannel,
    SmsChannel,
    WhatsAppChannel,
    NotificationOrchestrator,
    NotificationActionTokenService,
    WhatsAppReplyService,
    WhatsAppInboxPersistenceService,
    WhatsAppInboundService,
  ],
  controllers: [NotificationsController],
  exports: [
    NotificationsService,
    DeepLinkService,
    NotificationOrchestrator,
    NotificationPreferenceService,
    NotificationAnalyticsService,
    WhatsAppInboundService,
    WhatsAppReplyService,
    WhatsAppInboxPersistenceService,
    NotificationActionTokenService,
    WhatsAppTemplateService,
    WhatsAppChannel,
  ],
})
export class NotificationsModule {}
