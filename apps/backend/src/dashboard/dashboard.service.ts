import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PermissionService } from '../auth/permission.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { PlatformPermissions } from '../rbac/platform-permissions';
import { RbacService } from '../rbac/rbac.service';

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
  /** Distinct clients who ordered or rented from this business. */
  uniqueClientCount: number;
  clientCount?: number;
  agentsVerified?: number;
  agentsUnverified?: number;
  businessesVerified?: number;
  businessesNotVerified?: number;
}

export interface ClientCityFrequencyDto {
  name: string;
  count: number;
}

export interface ClientCitiesDto {
  cities: ClientCityFrequencyDto[];
  totalClientsWithCity: number;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly permissionService: PermissionService,
    private readonly rbacService: RbacService
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
    const includePlatformStats = await this.canViewPlatformStats(user.id);

    const [
      ordersByStatus,
      pendingCashReconciliationCount,
      itemCount,
      rentalItemCount,
      locationCount,
      inventoryCount,
      pendingFailedDeliveriesCount,
      uniqueClientCount,
      adminAggregates,
    ] = await Promise.all([
      this.getOrdersByStatus(businessId),
      this.getPendingCashReconciliationCount(businessId),
      this.getItemCount(businessId),
      this.getRentalItemCount(businessId),
      this.getLocationCount(businessId),
      this.getInventoryCount(businessId),
      this.getPendingFailedDeliveriesCount(businessId),
      this.getUniqueClientCount(businessId),
      includePlatformStats
        ? this.getAdminAggregates()
        : Promise.resolve(null),
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
      uniqueClientCount,
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

  private async canViewPlatformStats(userId: string): Promise<boolean> {
    if (await this.permissionService.isBusinessAdmin(userId)) return true;
    return this.rbacService.hasAnyPermission(userId, [
      PlatformPermissions.DASHBOARD_PLATFORM_STATS,
      PlatformPermissions.MANAGE_AGENTS,
      PlatformPermissions.MANAGE_CLIENTS,
      PlatformPermissions.MANAGE_BUSINESSES,
    ]);
  }

  async getClientCities(): Promise<ClientCitiesDto> {
    const businessId = await this.requireBusinessId();
    const clients = await this.fetchAllBusinessClientsForCities(businessId);
    const clientCity = this.resolvePrimaryCityPerClient(clients);
    return this.toCityFrequencies(clientCity);
  }

  private async requireBusinessId(): Promise<string> {
    const user = await this.hasuraUserService.getUser();
    if (user.user_type_id !== 'business' || !user.business?.id) {
      throw new HttpException(
        'Client cities require a business user',
        HttpStatus.FORBIDDEN
      );
    }
    return user.business.id;
  }

  private static readonly CLIENT_PAGE_SIZE = 500;

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

  private async getUniqueClientCount(businessId: string): Promise<number> {
    const query = `
      query DashboardUniqueClientCount($businessId: uuid!) {
        clients_aggregate(
          where: {
            _or: [
              { orders: { business_id: { _eq: $businessId } } }
              { rental_bookings: { business_id: { _eq: $businessId } } }
            ]
          }
        ) {
          aggregate { count }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      businessId,
    });
    return result?.clients_aggregate?.aggregate?.count ?? 0;
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

  private async fetchAllBusinessClientsForCities(businessId: string): Promise<
    BusinessClientCityRow[]
  > {
    const clients: BusinessClientCityRow[] = [];
    let offset = 0;
    for (;;) {
      const page = await this.fetchBusinessClientsCityPage(businessId, offset);
      clients.push(...page);
      if (page.length < DashboardService.CLIENT_PAGE_SIZE) break;
      offset += DashboardService.CLIENT_PAGE_SIZE;
    }
    return clients;
  }

  private async fetchBusinessClientsCityPage(
    businessId: string,
    offset: number
  ): Promise<BusinessClientCityRow[]> {
    const query = `
      query DashboardClientCitiesPage(
        $businessId: uuid!
        $limit: Int!
        $offset: Int!
      ) {
        clients(
          where: {
            _or: [
              { orders: { business_id: { _eq: $businessId } } }
              { rental_bookings: { business_id: { _eq: $businessId } } }
            ]
          }
          order_by: { id: asc }
          limit: $limit
          offset: $offset
        ) {
          id
          client_addresses(where: { address: { status: { _eq: active } } }) {
            address { city is_primary }
          }
          orders(
            where: { business_id: { _eq: $businessId } }
            order_by: { created_at: desc }
            limit: 25
          ) {
            delivery_address { city }
          }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery<{
      clients: BusinessClientCityRow[];
    }>(query, {
      businessId,
      limit: DashboardService.CLIENT_PAGE_SIZE,
      offset,
    });
    return result?.clients ?? [];
  }

  private resolvePrimaryCityPerClient(
    clients: BusinessClientCityRow[]
  ): Map<string, string> {
    const result = new Map<string, string>();
    for (const client of clients) {
      const city =
        this.topDeliveryCity(client.orders) ??
        this.profileCityForClient(client);
      if (city) result.set(client.id, city);
    }
    return result;
  }

  private topDeliveryCity(
    orders: { delivery_address?: { city?: string | null } | null }[]
  ): string | undefined {
    const votes = new Map<string, number>();
    for (const order of orders ?? []) {
      const city = this.normalizeCity(order.delivery_address?.city);
      if (!city) continue;
      votes.set(city, (votes.get(city) ?? 0) + 1);
    }
    return this.topVotedCity(votes);
  }

  private profileCityForClient(client: BusinessClientCityRow): string | null {
    const primary = client.client_addresses.find(
      (a) => a.address?.is_primary && this.normalizeCity(a.address?.city)
    );
    const any = client.client_addresses.find((a) =>
      this.normalizeCity(a.address?.city)
    );
    return this.normalizeCity(primary?.address?.city ?? any?.address?.city);
  }

  private topVotedCity(votes?: Map<string, number>): string | undefined {
    if (!votes?.size) return undefined;
    let best: string | undefined;
    let bestCount = -1;
    for (const [city, count] of votes) {
      if (count > bestCount) {
        best = city;
        bestCount = count;
      }
    }
    return best;
  }

  private normalizeCity(city?: string | null): string | null {
    const trimmed = city?.trim();
    if (!trimmed) return null;
    return trimmed.replace(/\s+/g, ' ');
  }

  private toCityFrequencies(
    clientCity: Map<string, string>
  ): ClientCitiesDto {
    const counts = new Map<string, number>();
    const display = new Map<string, string>();
    for (const city of clientCity.values()) {
      const key = city.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (!display.has(key)) display.set(key, city);
    }
    const cities = [...counts.entries()]
      .map(([key, count]) => ({ name: display.get(key) ?? key, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return { cities, totalClientsWithCity: clientCity.size };
  }
}

interface BusinessClientCityRow {
  id: string;
  client_addresses: {
    address?: { city?: string | null; is_primary?: boolean | null } | null;
  }[];
  orders: { delivery_address?: { city?: string | null } | null }[];
}
