import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';

export interface DashboardAggregatesDto {
  ordersTotal: number;
  ordersByStatus: Record<string, number>;
  /** Pay-at-delivery cash exceptions awaiting business mobile reconciliation. */
  pendingCashReconciliationCount: number;
  itemCount: number;
  rentalItemCount: number;
  locationCount: number;
  inventoryCount: number;
  pendingFailedDeliveriesCount: number;
  clientCount?: number;
  agentsVerified?: number;
  agentsUnverified?: number;
  businessesVerified?: number;
  businessesNotVerified?: number;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService
  ) {}

  async getAggregates(): Promise<DashboardAggregatesDto> {
    const user = await this.hasuraUserService.getUser();
    if (user.user_type_id !== 'business' || !user.business?.id) {
      throw new HttpException(
        'Dashboard aggregates require a business user',
        HttpStatus.FORBIDDEN
      );
    }
    const businessId = user.business.id;
    const isAdmin = user.business.is_admin === true;

    const [
      ordersByStatus,
      pendingCashReconciliationCount,
      itemCount,
      rentalItemCount,
      locationCount,
      inventoryCount,
      pendingFailedDeliveriesCount,
      adminAggregates,
    ] = await Promise.all([
      this.getOrdersByStatus(businessId),
      this.getPendingCashReconciliationCount(businessId),
      this.getItemCount(businessId),
      this.getRentalItemCount(businessId),
      this.getLocationCount(businessId),
      this.getInventoryCount(businessId),
      this.getPendingFailedDeliveriesCount(businessId),
      isAdmin ? this.getAdminAggregates() : Promise.resolve(null),
    ]);

    const ordersTotal = Object.values(ordersByStatus).reduce((a, b) => a + b, 0);

    const result: DashboardAggregatesDto = {
      ordersTotal,
      ordersByStatus,
      pendingCashReconciliationCount,
      itemCount,
      rentalItemCount,
      locationCount,
      inventoryCount,
      pendingFailedDeliveriesCount,
    };
    if (adminAggregates) {
      result.clientCount = adminAggregates.clientCount;
      result.agentsVerified = adminAggregates.agentsVerified;
      result.agentsUnverified = adminAggregates.agentsUnverified;
      result.businessesVerified = adminAggregates.businessesVerified;
      result.businessesNotVerified = adminAggregates.businessesNotVerified;
    }
    return result;
  }

  private async getOrdersByStatus(
    businessId: string
  ): Promise<Record<string, number>> {
    const query = `
      query DashboardOrdersByStatus($businessId: uuid!) {
        orders(
          where: {
            business_id: { _eq: $businessId }
            current_status: { _neq: "cancelled" }
          }
        ) {
          current_status
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      businessId,
    });
    const rows = (result?.orders ?? []) as { current_status: string }[];
    const byStatus: Record<string, number> = {};
    rows.forEach((r) => {
      const s = r.current_status || '';
      byStatus[s] = (byStatus[s] ?? 0) + 1;
    });
    return byStatus;
  }

  private async getPendingCashReconciliationCount(
    businessId: string
  ): Promise<number> {
    const query = `
      query DashboardPendingCashReconciliation($businessId: uuid!) {
        orders_aggregate(
          where: {
            business_id: { _eq: $businessId }
            reconciliation_status: { _eq: pending_manual_reconciliation }
          }
        ) {
          aggregate {
            count
          }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      businessId,
    });
    return result?.orders_aggregate?.aggregate?.count ?? 0;
  }

  private async getItemCount(businessId: string): Promise<number> {
    const query = `
      query DashboardItemCount($businessId: uuid!) {
        items_aggregate(where: { business_id: { _eq: $businessId } }) {
          aggregate { count }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      businessId,
    });
    return result?.items_aggregate?.aggregate?.count ?? 0;
  }

  private async getRentalItemCount(businessId: string): Promise<number> {
    const query = `
      query DashboardRentalItemCount($businessId: uuid!) {
        rental_items_aggregate(where: { business_id: { _eq: $businessId } }) {
          aggregate { count }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      businessId,
    });
    return result?.rental_items_aggregate?.aggregate?.count ?? 0;
  }

  private async getLocationCount(businessId: string): Promise<number> {
    const query = `
      query DashboardLocationCount($businessId: uuid!) {
        business_locations_aggregate(where: { business_id: { _eq: $businessId } }) {
          aggregate { count }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      businessId,
    });
    return result?.business_locations_aggregate?.aggregate?.count ?? 0;
  }

  private async getInventoryCount(businessId: string): Promise<number> {
    const query = `
      query DashboardInventoryCount($businessId: uuid!) {
        business_inventory_aggregate(
          where: { business_location: { business_id: { _eq: $businessId } } }
        ) {
          aggregate { count }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      businessId,
    });
    return result?.business_inventory_aggregate?.aggregate?.count ?? 0;
  }

  private async getPendingFailedDeliveriesCount(
    businessId: string
  ): Promise<number> {
    const query = `
      query DashboardPendingFailed($businessId: uuid!) {
        failed_deliveries_aggregate(
          where: {
            order: { business_id: { _eq: $businessId } }
            status: { _eq: "pending" }
          }
        ) {
          aggregate { count }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      businessId,
    });
    return result?.failed_deliveries_aggregate?.aggregate?.count ?? 0;
  }

  private async getAdminAggregates(): Promise<{
    clientCount: number;
    agentsVerified: number;
    agentsUnverified: number;
    businessesVerified: number;
    businessesNotVerified: number;
  } | null> {
    const query = `
      query DashboardAdminAggregates {
        clients_aggregate { aggregate { count } }
        agents_verified: agents_aggregate(where: { is_verified: { _eq: true } }) {
          aggregate { count }
        }
        agents_unverified: agents_aggregate(where: { is_verified: { _eq: false } }) {
          aggregate { count }
        }
        businesses_verified: businesses_aggregate(where: { is_verified: { _eq: true } }) {
          aggregate { count }
        }
        businesses_not_verified: businesses_aggregate(where: { is_verified: { _eq: false } }) {
          aggregate { count }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {});
    return {
      clientCount: result?.clients_aggregate?.aggregate?.count ?? 0,
      agentsVerified: result?.agents_verified?.aggregate?.count ?? 0,
      agentsUnverified: result?.agents_unverified?.aggregate?.count ?? 0,
      businessesVerified: result?.businesses_verified?.aggregate?.count ?? 0,
      businessesNotVerified:
        result?.businesses_not_verified?.aggregate?.count ?? 0,
    };
  }
}
