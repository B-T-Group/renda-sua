import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { isActivePersona } from '../users/persona.util';
import { OrdersService } from './orders.service';

@Injectable()
export class FailedPickupsService {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly ordersService: OrdersService
  ) {}

  async getFailureReasons(language: 'en' | 'fr' = 'fr') {
    const query = `
      query GetPickupFailureReasons {
        pickup_failure_reasons(
          where: { is_active: { _eq: true } }
          order_by: { sort_order: asc }
        ) {
          id
          reason_key
          reason_en
          reason_fr
          is_active
          sort_order
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {});
    return (result.pickup_failure_reasons || []).map((reason: any) => ({
      id: reason.id,
      reason_key: reason.reason_key,
      reason: language === 'fr' ? reason.reason_fr : reason.reason_en,
      reason_en: reason.reason_en,
      reason_fr: reason.reason_fr,
      is_active: reason.is_active,
      sort_order: reason.sort_order,
    }));
  }

  async getFailedPickups(
    businessId: string,
    filters?: { status?: 'pending' | 'completed' },
    options?: { skipAuth?: boolean; locationId?: string }
  ) {
    if (!options?.skipAuth) {
      const user = await this.hasuraUserService.getUser();
      if (
        !isActivePersona(user, 'business') ||
        !user.business ||
        user.business.id !== businessId
      ) {
        throw new HttpException(
          'Access denied. You can only view failed pickups for your own business.',
          HttpStatus.FORBIDDEN
        );
      }
    }

    const variables: Record<string, unknown> = { businessId };
    const whereParts = ['business_id: { _eq: $businessId }'];
    if (options?.locationId) {
      whereParts.push(
        'order: { business_location_id: { _eq: $locationId } }'
      );
      variables.locationId = options.locationId;
    }
    if (filters?.status) {
      whereParts.push('status: { _eq: $status }');
      variables.status = filters.status;
    }
    const whereClause = `{ ${whereParts.join(', ')} }`;

    const query = `
      query GetFailedPickups(
        $businessId: uuid!
        $locationId: uuid
        $status: failed_pickup_status_enum
      ) {
        failed_pickups(
          where: ${whereClause}
          order_by: { created_at: desc }
        ) {
          id
          order_id
          business_id
          reason_id
          notes
          status
          refund_amount
          fee_retained
          currency
          fulfillment_method
          created_at
          updated_at
          order {
            id
            order_number
            current_status
            total_amount
            currency
            business_id
            business_location_id
            fulfillment_method
            created_at
            client {
              id
              user {
                id
                first_name
                last_name
                email
                phone_number
              }
            }
          }
          failure_reason {
            id
            reason_key
            reason_en
            reason_fr
          }
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(
      query,
      variables
    );
    return result.failed_pickups || [];
  }

  async getFailedPickup(orderId: string) {
    const user = await this.hasuraUserService.getUser();
    if (!isActivePersona(user, 'business') || !user.business) {
      throw new HttpException(
        'Only business users can access failed pickups',
        HttpStatus.FORBIDDEN
      );
    }

    const query = `
      query GetFailedPickup($orderId: uuid!) {
        failed_pickups(where: { order_id: { _eq: $orderId } }, limit: 1) {
          id
          order_id
          business_id
          reason_id
          notes
          status
          refund_amount
          fee_retained
          currency
          fulfillment_method
          created_at
          updated_at
          order {
            id
            order_number
            current_status
            total_amount
            currency
            business_id
            client {
              id
              user {
                id
                first_name
                last_name
                email
              }
            }
          }
          failure_reason {
            id
            reason_key
            reason_en
            reason_fr
          }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      orderId,
    });
    const row = result.failed_pickups?.[0];
    if (!row) {
      throw new HttpException('Failed pickup not found', HttpStatus.NOT_FOUND);
    }
    if (row.business_id !== user.business.id) {
      throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
    }
    return row;
  }

  async failPickup(params: {
    orderId: string;
    failure_reason_id: string;
    notes?: string;
  }) {
    return this.ordersService.failPickup(params);
  }
}
