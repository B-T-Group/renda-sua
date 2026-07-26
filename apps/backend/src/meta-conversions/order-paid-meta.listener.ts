import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ORDER_PAID_EVENT } from './meta-conversions.constants';
import { MetaConversionsService } from './meta-conversions.service';
import type { OrderPaidEvent } from './meta-conversions.types';

@Injectable()
export class OrderPaidMetaListener {
  private readonly logger = new Logger(OrderPaidMetaListener.name);

  constructor(private readonly meta: MetaConversionsService) {}

  @OnEvent(ORDER_PAID_EVENT)
  async handle(event: OrderPaidEvent): Promise<void> {
    if (!event?.orderId) {
      this.logger.warn('order.paid missing orderId');
      return;
    }
    await this.meta.trackPurchaseSafe(event.orderId);
  }
}
