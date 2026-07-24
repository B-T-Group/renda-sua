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

export type ActionPriority = 'critical' | 'high' | 'normal';

export interface ActionItemDto {
  id: string;
  kind: string;
  priority: ActionPriority;
  count: number;
  primaryId?: string;
  primaryLabel?: string;
}

export interface ActionsNeededDto {
  actions: ActionItemDto[];
  totalCount: number;
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

  async getActionsNeeded(): Promise<ActionsNeededDto> {
    const user = await this.hasuraUserService.getUser();
    const persona = user.user_type_id;
    if (persona === 'business' && user.business?.id) {
      return this.getBusinessActions(user.business.id);
    }
    if (persona === 'agent' && user.agent?.id) {
      return this.getAgentActions(user.id);
    }
    if (persona === 'client' && user.client?.id) {
      return this.getClientActions(user.client.id);
    }
    return { actions: [], totalCount: 0 };
  }

  private async getBusinessActions(businessId: string): Promise<ActionsNeededDto> {
    const [
      itemProposals,
      itemRejected,
      rentalProposals,
      rentalRejected,
      ordersPending,
      cashCount,
      failedCount,
    ] = await Promise.all([
      this.countItemsByModeration(businessId, 'proposal_pending'),
      this.countItemsByModeration(businessId, 'rejected'),
      this.countRentalsByModeration(businessId, 'proposal_pending'),
      this.countRentalsByModeration(businessId, 'rejected'),
      this.countOrdersByStatus(businessId, 'pending'),
      this.getPendingCashReconciliationCount(businessId),
      this.getPendingFailedDeliveriesCount(businessId),
    ]);
    const raw: Array<Omit<ActionItemDto, 'count'> & { count: number }> = [
      { id: 'item_rejected', kind: 'item_rejected', priority: 'critical', count: itemRejected },
      { id: 'rental_rejected', kind: 'rental_rejected', priority: 'critical', count: rentalRejected },
      { id: 'item_proposal_pending', kind: 'item_proposal_pending', priority: 'high', count: itemProposals },
      { id: 'rental_proposal_pending', kind: 'rental_proposal_pending', priority: 'high', count: rentalProposals },
      { id: 'orders_pending', kind: 'orders_pending', priority: 'high', count: ordersPending },
      { id: 'failed_deliveries', kind: 'failed_deliveries', priority: 'high', count: failedCount },
      { id: 'cash_reconciliation', kind: 'cash_reconciliation', priority: 'normal', count: cashCount },
    ];
    return this.buildDto(raw);
  }

  private async getAgentActions(userId: string): Promise<ActionsNeededDto> {
    const [openOrders, activeOrders, idStatus] = await Promise.all([
      this.countAgentOpenOrders(userId),
      this.countAgentActiveOrders(userId),
      this.getAgentIdDocumentStatus(userId),
    ]);
    const raw: Array<Omit<ActionItemDto, 'count'> & { count: number }> = [
      { id: 'id_verification', kind: 'id_verification', priority: 'critical', count: idStatus.needsAction ? 1 : 0 },
      { id: 'open_deliveries', kind: 'open_deliveries', priority: 'high', count: openOrders },
      { id: 'active_orders', kind: 'active_orders', priority: 'normal', count: activeOrders },
    ];
    return this.buildDto(raw);
  }

  private async getClientActions(clientId: string): Promise<ActionsNeededDto> {
    const [pendingOrders, actionRequired] = await Promise.all([
      this.countClientOrdersByStatus(clientId, ['pending', 'pending_payment']),
      this.countClientActiveDeliveries(clientId),
    ]);
    const raw: Array<Omit<ActionItemDto, 'count'> & { count: number }> = [
      { id: 'orders_pending_payment', kind: 'orders_pending_payment', priority: 'high', count: pendingOrders },
      { id: 'active_delivery', kind: 'active_delivery', priority: 'normal', count: actionRequired },
    ];
    return this.buildDto(raw);
  }

  private buildDto(
    raw: Array<Omit<ActionItemDto, 'count'> & { count: number }>
  ): ActionsNeededDto {
    const actions = raw
      .filter((a) => a.count > 0)
      .sort((a, b) => {
        const order = { critical: 0, high: 1, normal: 2 };
        return order[a.priority] - order[b.priority];
      });
    return { actions, totalCount: actions.reduce((s, a) => s + a.count, 0) };
  }

  private async countItemsByModeration(businessId: string, status: string): Promise<number> {
    const q = `
      query ItemsByModeration($businessId: uuid!, $status: item_moderation_status!) {
        items_aggregate(where: { business_id: { _eq: $businessId }, moderation_status: { _eq: $status } }) {
          aggregate { count }
        }
      }
    `;
    const r = await this.hasuraSystemService.executeQuery(q, { businessId, status });
    return r?.items_aggregate?.aggregate?.count ?? 0;
  }

  private async countRentalsByModeration(businessId: string, status: string): Promise<number> {
    const q = `
      query RentalsByModeration($businessId: uuid!, $status: rental_listing_moderation_status!) {
        rental_location_listings_aggregate(
          where: { rental_item: { business_id: { _eq: $businessId } }, moderation_status: { _eq: $status } }
        ) { aggregate { count } }
      }
    `;
    const r = await this.hasuraSystemService.executeQuery(q, { businessId, status });
    return r?.rental_location_listings_aggregate?.aggregate?.count ?? 0;
  }

  private async countOrdersByStatus(businessId: string, status: string): Promise<number> {
    const q = `
      query OrdersByStatus($businessId: uuid!, $status: String!) {
        orders_aggregate(where: { business_id: { _eq: $businessId }, current_status: { _eq: $status } }) {
          aggregate { count }
        }
      }
    `;
    const r = await this.hasuraSystemService.executeQuery(q, { businessId, status });
    return r?.orders_aggregate?.aggregate?.count ?? 0;
  }

  private async countAgentOpenOrders(userId: string): Promise<number> {
    const q = `
      query AgentOpenOrdersByCountry($userId: uuid!) {
        agents(where: { user_id: { _eq: $userId } }) {
          user {
            addresses(where: { is_primary: { _eq: true } }, limit: 1) {
              country
            }
          }
        }
      }
    `;
    const r = await this.hasuraSystemService.executeQuery(q, { userId });
    const country: string | null = r?.agents?.[0]?.user?.addresses?.[0]?.country ?? null;
    if (!country) return 0;
    const countQ = `
      query AgentOpenOrdersCount($country: String!) {
        orders_aggregate(
          where: {
            current_status: { _eq: "pending" }
            assigned_agent_id: { _is_null: true }
            business: { locations: { address: { country: { _eq: $country } } } }
          }
        ) { aggregate { count } }
      }
    `;
    const countR = await this.hasuraSystemService.executeQuery(countQ, { country });
    return countR?.orders_aggregate?.aggregate?.count ?? 0;
  }

  private async countAgentActiveOrders(userId: string): Promise<number> {
    const q = `
      query AgentActiveOrders($userId: uuid!) {
        agents(where: { user_id: { _eq: $userId } }) {
          orders_aggregate(
            where: { current_status: { _in: ["confirmed","preparing","ready_for_pickup","assigned_to_agent","picked_up","in_transit","out_for_delivery"] } }
          ) { aggregate { count } }
        }
      }
    `;
    const r = await this.hasuraSystemService.executeQuery(q, { userId });
    return r?.agents?.[0]?.orders_aggregate?.aggregate?.count ?? 0;
  }

  private async getAgentIdDocumentStatus(
    userId: string
  ): Promise<{ needsAction: boolean; status: string }> {
    const q = `
      query AgentIdDoc($userId: uuid!) {
        user_uploads(where: { user_id: { _eq: $userId }, upload_type: { _eq: "id_document" } }, limit: 1, order_by: { created_at: desc }) {
          id status
        }
      }
    `;
    const r = await this.hasuraSystemService.executeQuery(q, { userId });
    const upload = r?.user_uploads?.[0];
    if (!upload) return { needsAction: true, status: 'missing' };
    const needsAction = upload.status === 'rejected' || upload.status === 'missing';
    return { needsAction, status: upload.status };
  }

  private async countClientOrdersByStatus(clientId: string, statuses: string[]): Promise<number> {
    const q = `
      query ClientPendingOrders($clientId: uuid!, $statuses: [String!]!) {
        orders_aggregate(
          where: { client_id: { _eq: $clientId }, current_status: { _in: $statuses } }
        ) { aggregate { count } }
      }
    `;
    const r = await this.hasuraSystemService.executeQuery(q, { clientId, statuses });
    return r?.orders_aggregate?.aggregate?.count ?? 0;
  }

  private async countClientActiveDeliveries(clientId: string): Promise<number> {
    const activeStatuses = ['picked_up', 'in_transit', 'out_for_delivery'];
    const q = `
      query ClientActiveDeliveries($clientId: uuid!, $statuses: [String!]!) {
        orders_aggregate(
          where: {
            client_id: { _eq: $clientId }
            current_status: { _in: $statuses }
            assigned_agent_id: { _is_null: false }
          }
        ) { aggregate { count } }
      }
    `;
    const r = await this.hasuraSystemService.executeQuery(q, { clientId, statuses: activeStatuses });
    return r?.orders_aggregate?.aggregate?.count ?? 0;
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
