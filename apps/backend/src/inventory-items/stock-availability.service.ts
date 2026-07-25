import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { StockAvailabilityPayloadV1 } from '../messaging/structured/structured-message.types';
import { isActivePersona } from '../users/persona.util';

export const LOW_STOCK_THRESHOLD = 5;
const ENTITY_TYPE = 'business_inventory';
const MESSAGE_TYPE = 'STOCK_AVAILABILITY';
const RATE_LIMIT_MS = 2 * 60 * 60 * 1000;

type InventoryRow = {
  id: string;
  item_id: string;
  quantity: number;
  reserved_quantity: number;
  computed_available_quantity?: number | null;
  business_location: {
    id: string;
    name?: string | null;
    business_id: string;
    business: {
      id: string;
      name?: string | null;
      user_id: string;
      user?: { first_name?: string | null; last_name?: string | null } | null;
    };
  };
  item: {
    id: string;
    name: string;
    item_images?: Array<{
      image_url?: string | null;
      image_type?: string | null;
    }>;
  };
};

export type StockAvailabilityCheckDto = {
  messageId: string;
  status: StockAvailabilityPayloadV1['status'];
  inventoryId: string;
  itemId: string;
  itemName: string;
  itemImageUrl: string | null;
  locationName: string | null;
  businessName: string | null;
  quantityAtRequest: number;
  currentQuantity: number;
  currentAvailable: number;
  clientName: string;
  quantityAfterResponse?: number;
  respondedAt?: string;
};

export type RespondAction = 'confirm' | 'unavailable' | 'adjust';

@Injectable()
export class StockAvailabilityService {
  private readonly logger = new Logger(StockAvailabilityService.name);

  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly notificationsService: NotificationsService
  ) {}

  async requestCheck(inventoryId: string): Promise<{ messageId: string }> {
    const user = await this.hasuraUserService.getUser();
    if (!isActivePersona(user, 'client') || !user.client?.id) {
      throw new HttpException('Only clients can check availability', HttpStatus.FORBIDDEN);
    }
    const inv = await this.loadInventory(inventoryId);
    const available = this.availableQty(inv);
    if (available <= 0 || available > LOW_STOCK_THRESHOLD) {
      throw new HttpException(
        'Availability check is only available when stock is low',
        HttpStatus.BAD_REQUEST
      );
    }
    await this.assertNoRecentPending(inventoryId, user.id);
    const payload = this.buildPendingPayload(inv, user.id, available);
    const businessUserId = inv.business_location.business.user_id;
    const messageId = await this.insertMessage(
      businessUserId,
      inventoryId,
      inv.item.name,
      payload
    );
    await this.insertRecipient(messageId, businessUserId);
    await this.notifyBusiness(inv, user, messageId);
    return { messageId };
  }

  async getCheck(messageId: string): Promise<StockAvailabilityCheckDto> {
    const user = await this.hasuraUserService.getUser();
    if (!isActivePersona(user, 'business') || !user.business?.id) {
      throw new HttpException('Business only', HttpStatus.FORBIDDEN);
    }
    const msg = await this.loadMessage(messageId);
    const payload = msg.message_payload;
    if (payload.businessId !== user.business.id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    const inv = await this.loadInventory(payload.inventoryId);
    const clientUser = await this.loadUserName(payload.clientUserId);
    return this.toDto(msg.id, payload, inv, clientUser);
  }

  async respond(
    messageId: string,
    body: { action: RespondAction; quantity?: number }
  ): Promise<StockAvailabilityCheckDto> {
    const user = await this.hasuraUserService.getUser();
    if (!isActivePersona(user, 'business') || !user.business?.id) {
      throw new HttpException('Business only', HttpStatus.FORBIDDEN);
    }
    const msg = await this.loadMessage(messageId);
    const payload = msg.message_payload;
    if (payload.businessId !== user.business.id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    if (payload.status !== 'pending') {
      throw new HttpException('This check was already answered', HttpStatus.CONFLICT);
    }
    const next = await this.applyResponse(payload, user.id, body);
    await this.updatePayloadIfPending(messageId, next);
    const inv = await this.loadInventory(payload.inventoryId);
    await this.notifyClient(next, inv.item.name, messageId);
    const clientUser = await this.loadUserName(payload.clientUserId);
    return this.toDto(messageId, next, inv, clientUser);
  }

  private async applyResponse(
    payload: StockAvailabilityPayloadV1,
    responderId: string,
    body: { action: RespondAction; quantity?: number }
  ): Promise<StockAvailabilityPayloadV1> {
    const respondedAt = new Date().toISOString();
    if (body.action === 'unavailable') {
      return {
        ...payload,
        status: 'unavailable',
        respondedAt,
        respondedByUserId: responderId,
      };
    }
    if (body.action === 'adjust') {
      return this.applyAdjust(payload, responderId, body.quantity, respondedAt);
    }
    if (body.action === 'confirm') {
      return {
        ...payload,
        status: 'confirmed',
        quantityAfterResponse: payload.quantityAtRequest,
        respondedAt,
        respondedByUserId: responderId,
      };
    }
    throw new HttpException('Invalid action', HttpStatus.BAD_REQUEST);
  }

  private async applyAdjust(
    payload: StockAvailabilityPayloadV1,
    responderId: string,
    quantity: number | undefined,
    respondedAt: string
  ): Promise<StockAvailabilityPayloadV1> {
    if (quantity == null || !Number.isFinite(quantity) || quantity < 0) {
      throw new HttpException('quantity is required for adjust', HttpStatus.BAD_REQUEST);
    }
    await this.setInventoryQuantity(payload.inventoryId, Math.floor(quantity));
    const inv = await this.loadInventory(payload.inventoryId);
    return {
      ...payload,
      status: 'adjusted',
      quantityAfterResponse: this.availableQty(inv),
      respondedAt,
      respondedByUserId: responderId,
    };
  }

  private availableQty(inv: InventoryRow): number {
    if (typeof inv.computed_available_quantity === 'number') {
      return inv.computed_available_quantity;
    }
    return Math.max(0, (inv.quantity ?? 0) - (inv.reserved_quantity ?? 0));
  }

  private buildPendingPayload(
    inv: InventoryRow,
    clientUserId: string,
    available: number
  ): StockAvailabilityPayloadV1 {
    return {
      version: 1,
      status: 'pending',
      inventoryId: inv.id,
      itemId: inv.item_id,
      businessId: inv.business_location.business_id,
      clientUserId,
      quantityAtRequest: available,
    };
  }

  private async assertNoRecentPending(
    inventoryId: string,
    clientUserId: string
  ): Promise<void> {
    const since = new Date(Date.now() - RATE_LIMIT_MS).toISOString();
    const r = await this.hasuraSystemService.executeQuery<{
      user_messages: Array<{ id: string; message_payload: StockAvailabilityPayloadV1 }>;
    }>(
      `query RecentChecks($inventoryId: uuid!, $entityType: entity_types_enum!, $since: timestamptz!) {
        user_messages(
          where: {
            entity_id: { _eq: $inventoryId }
            entity_type: { _eq: $entityType }
            message_type: { _eq: "${MESSAGE_TYPE}" }
            created_at: { _gte: $since }
          }
          order_by: { created_at: desc }
          limit: 20
        ) { id message_payload }
      }`,
      { inventoryId, entityType: ENTITY_TYPE, since }
    );
    for (const row of r.user_messages ?? []) {
      const p = row.message_payload;
      if (p?.clientUserId !== clientUserId) continue;
      if (p.status === 'pending') {
        throw new HttpException(
          'You already have a pending availability check for this item',
          HttpStatus.CONFLICT
        );
      }
      throw new HttpException(
        'Please wait before requesting another availability check',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }

  private async loadInventory(inventoryId: string): Promise<InventoryRow> {
    const r = await this.hasuraSystemService.executeQuery<{
      business_inventory_by_pk: InventoryRow | null;
    }>(
      `query StockAvailInv($id: uuid!) {
        business_inventory_by_pk(id: $id) {
          id item_id quantity reserved_quantity computed_available_quantity
          business_location {
            id name business_id
            business { id name user_id user { first_name last_name } }
          }
          item {
            id name
            item_images(limit: 5, order_by: { display_order: asc }) {
              image_url
              image_type
            }
          }
        }
      }`,
      { id: inventoryId }
    );
    if (!r.business_inventory_by_pk) {
      throw new HttpException('Inventory not found', HttpStatus.NOT_FOUND);
    }
    return r.business_inventory_by_pk;
  }

  private async loadUserName(
    userId: string
  ): Promise<{ first_name?: string | null; last_name?: string | null } | null> {
    const r = await this.hasuraSystemService.executeQuery<{
      users_by_pk: { first_name?: string | null; last_name?: string | null } | null;
    }>(
      `query StockAvailUser($id: uuid!) {
        users_by_pk(id: $id) { first_name last_name }
      }`,
      { id: userId }
    );
    return r.users_by_pk;
  }

  private async loadMessage(messageId: string): Promise<{
    id: string;
    message_payload: StockAvailabilityPayloadV1;
  }> {
    const r = await this.hasuraSystemService.executeQuery<{
      user_messages_by_pk: {
        id: string;
        message_type: string;
        entity_type: string;
        message_payload: StockAvailabilityPayloadV1;
      } | null;
    }>(
      `query StockAvailMsg($id: uuid!) {
        user_messages_by_pk(id: $id) {
          id message_type entity_type message_payload
        }
      }`,
      { id: messageId }
    );
    const msg = r.user_messages_by_pk;
    if (
      !msg ||
      msg.message_type !== MESSAGE_TYPE ||
      msg.entity_type !== ENTITY_TYPE ||
      msg.message_payload?.version !== 1
    ) {
      throw new HttpException('Availability check not found', HttpStatus.NOT_FOUND);
    }
    return msg;
  }

  private async insertMessage(
    userId: string,
    inventoryId: string,
    itemName: string,
    payload: StockAvailabilityPayloadV1
  ): Promise<string> {
    const message = JSON.stringify({
      i18nKey: 'items.availability.requestMessage',
      params: { itemName },
    });
    const r = await this.hasuraSystemService.executeMutation<{
      insert_user_messages_one: { id: string } | null;
    }>(
      `mutation InsertStockAvail(
        $user_id: uuid!
        $entity_type: entity_types_enum!
        $entity_id: uuid!
        $message: String!
        $message_payload: jsonb!
      ) {
        insert_user_messages_one(object: {
          user_id: $user_id
          entity_type: $entity_type
          entity_id: $entity_id
          message: $message
          message_type: ${MESSAGE_TYPE}
          message_payload: $message_payload
          is_immutable: false
        }) { id }
      }`,
      {
        user_id: userId,
        entity_type: ENTITY_TYPE,
        entity_id: inventoryId,
        message,
        message_payload: payload,
      }
    );
    const id = r.insert_user_messages_one?.id;
    if (!id) {
      throw new HttpException('Failed to create availability check', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return id;
  }

  private async insertRecipient(messageId: string, businessUserId: string): Promise<void> {
    await this.hasuraSystemService.executeMutation(
      `mutation InsertStockAvailRecipient($objects: [message_recipients_insert_input!]!) {
        insert_message_recipients(objects: $objects) { affected_rows }
      }`,
      {
        objects: [
          {
            message_id: messageId,
            recipient_user_id: businessUserId,
            recipient_type: 'mentioned',
          },
        ],
      }
    );
  }

  private async updatePayloadIfPending(
    messageId: string,
    payload: StockAvailabilityPayloadV1
  ): Promise<void> {
    const r = await this.hasuraSystemService.executeMutation<{
      update_user_messages: { affected_rows: number } | null;
    }>(
      `mutation UpdateStockAvailIfPending($id: uuid!, $payload: jsonb!) {
        update_user_messages(
          where: {
            id: { _eq: $id }
            message_payload: { _contains: { status: "pending" } }
          }
          _set: { message_payload: $payload }
        ) { affected_rows }
      }`,
      { id: messageId, payload }
    );
    if ((r.update_user_messages?.affected_rows ?? 0) < 1) {
      throw new HttpException('This check was already answered', HttpStatus.CONFLICT);
    }
  }

  private async setInventoryQuantity(inventoryId: string, quantity: number): Promise<void> {
    await this.hasuraSystemService.executeMutation(
      `mutation SetStockQty($id: uuid!, $updates: business_inventory_set_input!) {
        update_business_inventory_by_pk(
          pk_columns: { id: $id }
          _set: $updates
        ) { id }
      }`,
      { id: inventoryId, updates: { quantity } }
    );
  }

  private async notifyBusiness(
    inv: InventoryRow,
    clientUser: { first_name?: string | null; last_name?: string | null },
    messageId: string
  ): Promise<void> {
    const clientName = displayName(clientUser) || 'A shopper';
    try {
      await this.notificationsService.sendStockAvailabilityCheckPush({
        recipientUserId: inv.business_location.business.user_id,
        inventoryId: inv.id,
        itemId: inv.item_id,
        messageId,
        itemName: inv.item.name,
        clientName,
      });
    } catch (error: any) {
      this.logger.warn(`notifyBusiness failed: ${error?.message ?? String(error)}`);
    }
  }

  private async notifyClient(
    payload: StockAvailabilityPayloadV1,
    itemName: string,
    messageId: string
  ): Promise<void> {
    if (payload.status === 'pending') return;
    try {
      await this.notificationsService.sendStockAvailabilityResultPush({
        recipientUserId: payload.clientUserId,
        inventoryId: payload.inventoryId,
        messageId,
        itemName,
        status: payload.status,
        quantity: payload.quantityAfterResponse,
      });
    } catch (error: any) {
      this.logger.warn(`notifyClient failed: ${error?.message ?? String(error)}`);
    }
  }

  private toDto(
    messageId: string,
    payload: StockAvailabilityPayloadV1,
    inv: InventoryRow,
    clientUser?: { first_name?: string | null; last_name?: string | null } | null
  ): StockAvailabilityCheckDto {
    const images = inv.item.item_images ?? [];
    const primary =
      images.find((i) => i.image_type === 'main') ?? images[0];
    return {
      messageId,
      status: payload.status,
      inventoryId: payload.inventoryId,
      itemId: payload.itemId,
      itemName: inv.item.name,
      itemImageUrl: primary?.image_url ?? null,
      locationName: inv.business_location.name ?? null,
      businessName: inv.business_location.business.name ?? null,
      quantityAtRequest: payload.quantityAtRequest,
      currentQuantity: inv.quantity ?? 0,
      currentAvailable: this.availableQty(inv),
      clientName: displayName(clientUser) || 'Shopper',
      quantityAfterResponse: payload.quantityAfterResponse,
      respondedAt: payload.respondedAt,
    };
  }
}

function displayName(
  user?: { first_name?: string | null; last_name?: string | null } | null
): string {
  return `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();
}
