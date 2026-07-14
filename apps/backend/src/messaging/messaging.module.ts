import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DeliveryPinModule } from '../delivery-pin/delivery-pin.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RbacModule } from '../rbac/rbac.module';
import { DeliveryPinShareService } from './structured/delivery-pin-share.service';
import { DeliveryPinMessageHandler } from './structured/handlers/delivery-pin.handler';
import { StructuredMessageTypeRegistry } from './structured/structured-message.registry';
import { MentionValidationService } from './mention-validation.service';
import { MessageCreatedListener } from './message-created.listener';
import { MessagingService } from './messaging.service';
import { OrderParticipantsService } from './order-participants.service';
import { RecipientResolutionService } from './recipient-resolution.service';

@Module({
  imports: [ConfigModule, NotificationsModule, DeliveryPinModule, RbacModule],
  providers: [
    MessagingService,
    OrderParticipantsService,
    MentionValidationService,
    RecipientResolutionService,
    MessageCreatedListener,
    StructuredMessageTypeRegistry,
    DeliveryPinMessageHandler,
    DeliveryPinShareService,
    {
      provide: 'STRUCTURED_MESSAGE_REGISTRY_INIT',
      useFactory: (
        registry: StructuredMessageTypeRegistry,
        deliveryPinHandler: DeliveryPinMessageHandler
      ) => {
        registry.register(deliveryPinHandler);
        return registry;
      },
      inject: [StructuredMessageTypeRegistry, DeliveryPinMessageHandler],
    },
  ],
  exports: [
    MessagingService,
    OrderParticipantsService,
    DeliveryPinShareService,
    StructuredMessageTypeRegistry,
  ],
})
export class MessagingModule implements OnModuleInit {
  constructor(
    private readonly registry: StructuredMessageTypeRegistry,
    private readonly deliveryPinHandler: DeliveryPinMessageHandler
  ) {}

  onModuleInit(): void {
    if (!this.registry.get('DELIVERY_PIN')) {
      this.registry.register(this.deliveryPinHandler);
    }
  }
}
