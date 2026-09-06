import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type { OrderRiskActionContext } from './order-risk.types';
import {
  mapOrderRiskContext,
  type OrderRiskContextRow,
} from './order-risk-context.util';

/**
 * Loads the "who do I call" facts that ride along with an order risk alert.
 * Kept separate from the rules so a failed lookup can never suppress the alert.
 */
@Injectable()
export class OrderRiskContextService {
  private readonly logger = new Logger(OrderRiskContextService.name);

  constructor(private readonly hasura: HasuraSystemService) {}

  async load(orderId: string): Promise<OrderRiskActionContext | undefined> {
    try {
      const res = await this.hasura.executeQuery<{
        orders_by_pk: OrderRiskContextRow | null;
      }>(
        `query OrderRiskContext($id: uuid!) {
          orders_by_pk(id: $id) {
            total_amount
            currency
            grace_deadline_at
            client { user { first_name last_name } }
            business {
              name
              user { phone_number }
              referring_agent { user_id }
            }
            business_location {
              name
              phone
              address { country }
            }
            delivery_address { country }
          }
        }`,
        { id: orderId }
      );
      const order = res?.orders_by_pk;
      return order ? mapOrderRiskContext(order) : undefined;
    } catch (error: any) {
      this.logger.warn(
        `Order risk context load failed for ${orderId}: ${error?.message}`
      );
      return undefined;
    }
  }
}
