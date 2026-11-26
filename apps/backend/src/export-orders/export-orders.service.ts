import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateExportOrderDto } from './dto/create-export-order.dto';
import { EXPORT_EVENTS } from './export-order.statuses';
import { ExportOrdersPdfService } from './export-orders-pdf.service';
import { ExportOrdersTransitionService } from './export-orders-transition.service';
import {
  CONFIG_EXPORT_ENABLED,
  GET_CLIENT_REFERRAL,
  GET_INVENTORY_FOR_EXPORT,
  INSERT_EXPORT_ORDER,
  INSERT_VERSION,
  LIST_EXPORT_ORDERS,
} from './export-orders.queries';
import type { ExportOrderRow } from './export-orders.types';

type InventoryRow = {
  id: string;
  is_active: boolean;
  business_location_id: string;
  item_id: string;
  business_location: {
    id: string;
    name: string | null;
    business_id: string;
    business: { id: string; name: string | null; user_id: string } | null;
  } | null;
  item: {
    id: string;
    name: string;
    description: string | null;
    export_available: boolean;
    moderation_status: string;
    is_active: boolean;
  } | null;
};

@Injectable()
export class ExportOrdersService {
  private readonly logger = new Logger(ExportOrdersService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly hasuraUser: HasuraUserService,
    private readonly transitions: ExportOrdersTransitionService,
    private readonly notifications: NotificationsService,
    private readonly pdf: ExportOrdersPdfService
  ) {}

  async isExportOrdersEnabled(countryCode?: string): Promise<boolean> {
    try {
      const res = await this.hasura.executeQuery<{
        application_configurations: Array<{
          boolean_value: boolean | null;
          country_code: string | null;
        }>;
      }>(CONFIG_EXPORT_ENABLED);
      const rows = res.application_configurations ?? [];
      const country = countryCode
        ? rows.find((r) => r.country_code === countryCode)
        : undefined;
      const global = rows.find((r) => r.country_code == null);
      return Boolean(country?.boolean_value ?? global?.boolean_value ?? false);
    } catch (error: any) {
      this.logger.warn(`isExportOrdersEnabled: ${error?.message}`);
      return false;
    }
  }

  async createFromInterest(dto: CreateExportOrderDto) {
    const user = await this.hasuraUser.getUser();
    if (!user.client?.id) {
      throw new HttpException(
        'Only clients can submit export interest',
        HttpStatus.FORBIDDEN
      );
    }
    const inventory = await this.fetchInventory(dto.businessInventoryId);
    this.assertEligible(inventory);
    const country = (dto.countryCode || 'CM').toUpperCase();
    if (!(await this.isExportOrdersEnabled(country))) {
      throw new HttpException(
        {
          success: false,
          error: 'EXPORT_ORDERS_DISABLED',
          message: 'Export order workflow is not enabled',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    await this.assertNoOverdueFinancing(user.id);
    const referral = await this.loadReferral(user.id);
    const qty = dto.quantity && dto.quantity > 0 ? dto.quantity : 1;
    const created = await this.insertOrder({
      userId: user.id,
      clientId: user.client.id,
      agentUserId: referral?.referred_by_user_id ?? null,
      inventory,
      dto,
      qty,
      country,
    });
    await this.snapshotBcVersion(created.id, user.id);
    const order = await this.transitions.getOrder(created.id);
    try {
      await this.pdf.issueBc(order, user.id);
    } catch (error: any) {
      this.logger.warn(`BC PDF ${created.id}: ${error?.message}`);
    }
    await this.notifySubmitted(created, user, inventory);
    return this.transitions.getOrder(created.id);
  }

  async getById(id: string) {
    return this.transitions.getOrder(id);
  }

  async listForActor(params: {
    role: 'client' | 'agent' | 'business' | 'admin';
    page?: number;
    limit?: number;
    status?: string;
  }) {
    const user = await this.hasuraUser.getUser();
    const safe = this.paginate(params.page, params.limit);
    const where = this.buildListWhere(params.role, user, params.status);
    const res = await this.hasura.executeQuery<{
      export_orders_aggregate: { aggregate: { count: number } };
      export_orders: ExportOrderRow[];
    }>(LIST_EXPORT_ORDERS, {
      where,
      limit: safe.limit,
      offset: safe.offset,
    });
    return {
      items: res.export_orders ?? [],
      total: res.export_orders_aggregate?.aggregate?.count ?? 0,
      page: safe.page,
      limit: safe.limit,
      totalPages: Math.max(
        1,
        Math.ceil(
          (res.export_orders_aggregate?.aggregate?.count ?? 0) / safe.limit
        )
      ),
    };
  }

  async startReview(orderId: string, actorUserId: string) {
    return this.transitions.transition({
      orderId,
      to: 'IN_REVIEW',
      eventName: EXPORT_EVENTS.reviewStarted,
      actorUserId,
      actorRole: 'admin',
    });
  }

  async clientResubmitAfterChanges(orderId: string, note?: string) {
    const user = await this.hasuraUser.getUser();
    const order = await this.transitions.getOrder(orderId);
    this.assertClientOwns(order, user.id);
    const nextVersion = (order.bc_version || 1) + 1;
    const updated = await this.transitions.transition({
      orderId,
      to: 'IN_REVIEW',
      eventName: EXPORT_EVENTS.reviewStarted,
      actorUserId: user.id,
      actorRole: 'client',
      payload: { note },
      extraSet: {
        bc_version: nextVersion,
        client_note: note?.trim() || order.client_note,
        bc_expires_at: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
      },
    });
    await this.snapshotBcVersion(orderId, user.id, nextVersion);
    return updated;
  }

  private async fetchInventory(id: string): Promise<InventoryRow> {
    const res = await this.hasura.executeQuery<{
      business_inventory_by_pk: InventoryRow | null;
    }>(GET_INVENTORY_FOR_EXPORT, { id });
    if (!res.business_inventory_by_pk) {
      throw new HttpException('Listing not found', HttpStatus.NOT_FOUND);
    }
    return res.business_inventory_by_pk;
  }

  private assertEligible(inventory: InventoryRow) {
    const item = inventory.item;
    if (!inventory.is_active || !item?.is_active) {
      throw new HttpException('Listing is unavailable', HttpStatus.BAD_REQUEST);
    }
    if (item.moderation_status !== 'approved' || !item.export_available) {
      throw new HttpException(
        'Listing is not available for export orders',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async loadReferral(userId: string) {
    const res = await this.hasura.executeQuery<{
      clients: Array<{ id: string; referred_by_user_id: string | null }>;
    }>(GET_CLIENT_REFERRAL, { userId });
    return res.clients?.[0] ?? null;
  }

  private async insertOrder(params: {
    userId: string;
    clientId: string;
    agentUserId: string | null;
    inventory: InventoryRow;
    dto: CreateExportOrderDto;
    qty: number;
    country: string;
  }) {
    const location = params.inventory.business_location!;
    const res = await this.hasura.executeMutation<{
      insert_export_orders_one: {
        id: string;
        status: string;
        bc_number: string;
        bc_version: number;
        created_at: string;
        client_user_id: string;
        agent_user_id: string | null;
        business_id: string;
        country_code: string;
      };
    }>(INSERT_EXPORT_ORDER, {
      object: {
        status: 'SUBMITTED',
        client_user_id: params.userId,
        client_id: params.clientId,
        agent_user_id: params.agentUserId,
        business_id: location.business_id,
        business_location_id: location.id,
        country_code: params.country,
        currency: 'CAD',
        client_note: params.dto.note?.trim() || null,
        lines: {
          data: [
            {
              item_id: params.inventory.item_id,
              business_inventory_id: params.inventory.id,
              product_name: params.inventory.item!.name,
              characteristics: params.dto.characteristics?.trim() || null,
              particularities: params.dto.particularities?.trim() || null,
              quantity: params.qty,
              unit: 'ea',
              sort_order: 0,
            },
          ],
        },
      },
    });
    return res.insert_export_orders_one;
  }

  private async snapshotBcVersion(
    orderId: string,
    userId: string,
    version = 1
  ) {
    const order = await this.transitions.getOrder(orderId);
    await this.hasura.executeMutation(INSERT_VERSION, {
      object: {
        export_order_id: orderId,
        version_kind: 'BC',
        version_number: version,
        snapshot: { lines: order.lines, client_note: order.client_note },
        created_by: userId,
      },
    });
  }

  private async notifySubmitted(
    created: { id: string; bc_number: string; client_user_id: string },
    user: {
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
    },
    inventory: InventoryRow
  ) {
    try {
      const name =
        [user.first_name, user.last_name].filter(Boolean).join(' ') ||
        'Client';
      await this.notifications.sendBusinessProductInterestNotification({
        businessUserId: inventory.business_location!.business!.user_id,
        requestId: created.id,
        itemName: inventory.item?.name ?? 'Export product',
        locationName: inventory.business_location?.name?.trim() || '—',
        clientName: name,
        clientEmail: user.email ?? null,
        clientPhone: null,
        clientNote: `Export order ${created.bc_number}`,
        inventoryId: inventory.id,
      });
    } catch (error: any) {
      this.logger.error(`notifySubmitted ${created.id}: ${error?.message}`);
    }
  }

  private async assertNoOverdueFinancing(clientUserId: string) {
    const res = await this.hasura.executeQuery<{
      export_financing: Array<{ id: string }>;
    }>(
      `query OverdueFinancing($uid: uuid!) {
        export_financing(
          where: {
            status: { _eq: "overdue" }
            export_order: { client_user_id: { _eq: $uid } }
          }
          limit: 1
        ) { id }
      }`,
      { uid: clientUserId }
    );
    if ((res.export_financing ?? []).length > 0) {
      throw new HttpException(
        'New export orders blocked: overdue financing',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private assertClientOwns(order: ExportOrderRow, userId: string) {
    if (order.client_user_id !== userId) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
  }

  private buildListWhere(
    role: string,
    user: {
      id: string;
      business?: { id?: string } | null;
      agent?: { id?: string } | null;
    },
    status?: string
  ) {
    const where: Record<string, unknown> = {};
    if (status) where.status = { _eq: status };
    if (role === 'client') where.client_user_id = { _eq: user.id };
    if (role === 'agent') where.agent_user_id = { _eq: user.id };
    if (role === 'business') {
      if (!user.business?.id) {
        throw new HttpException('Business required', HttpStatus.FORBIDDEN);
      }
      where.business_id = { _eq: user.business.id };
    }
    return where;
  }

  private paginate(page?: number, limit?: number) {
    const safePage = page && page > 0 ? Math.floor(page) : 1;
    const safeLimit = Math.min(50, Math.max(1, limit ?? 20));
    return {
      page: safePage,
      limit: safeLimit,
      offset: (safePage - 1) * safeLimit,
    };
  }
}
