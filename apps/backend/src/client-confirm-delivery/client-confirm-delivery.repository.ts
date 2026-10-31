import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type { DeliveryConfirmationMethod } from './client-confirm-delivery.constants';
import type {
  ClientConfirmOrder,
  DeliveryProofPhotoInput,
} from './client-confirm-delivery.types';

const ORDER_FIELDS = `
  id order_number current_status fulfillment_method fulfillment_country
  payment_timing payment_status reconciliation_status
  delivery_pin_hash delivery_confirmation_method
  client_confirmation_requested_at client_confirmed_at
  auto_complete_deadline_at delivery_proof_submitted_at
  awaiting_confirm_reminder_1h_at awaiting_confirm_reminder_24h_at
  awaiting_confirm_support_ticket_id
  assigned_agent_id business_id client_id
  is_third_party_recipient recipient_name recipient_phone recipient_notify_whatsapp
  payer_name payer_country
  client { id user_id }
  assigned_agent { id user_id status }
  business { id user_id name }
  business_location { address { country } }
`;

@Injectable()
export class ClientConfirmDeliveryRepository {
  constructor(private readonly hasura: HasuraSystemService) {}

  async loadOrder(orderId: string): Promise<ClientConfirmOrder | null> {
    const res = await this.hasura.executeQuery<{
      orders_by_pk: ClientConfirmOrder | null;
    }>(
      `query ClientConfirmOrder($id: uuid!) {
        orders_by_pk(id: $id) { ${ORDER_FIELDS} }
      }`,
      { id: orderId }
    );
    return res.orders_by_pk ?? null;
  }

  async stampRequestedAt(orderId: string, at: string): Promise<void> {
    await this.hasura.executeMutation(
      `mutation StampConfirmRequested($id: uuid!, $at: timestamptz!) {
        update_orders_by_pk(pk_columns: { id: $id }, _set: {
          client_confirmation_requested_at: $at, updated_at: $at
        }) { id }
      }`,
      { id: orderId, at }
    );
  }

  async stampConfirmationMethod(
    orderId: string,
    method: DeliveryConfirmationMethod,
    at: string
  ): Promise<boolean> {
    const res = await this.hasura.executeMutation<{
      update_orders: { affected_rows: number };
    }>(
      `mutation StampConfirmMethod(
        $id: uuid!, $method: String!, $at: timestamptz!
      ) {
        update_orders(
          where: {
            id: { _eq: $id }
            delivery_confirmation_method: { _is_null: true }
          }
          _set: {
            delivery_confirmation_method: $method
            client_confirmed_at: $at
            updated_at: $at
          }
        ) { affected_rows }
      }`,
      { id: orderId, method, at }
    );
    return (res.update_orders?.affected_rows ?? 0) > 0;
  }

  async stampFallback(
    orderId: string,
    deadlineAt: string,
    submittedAt: string
  ): Promise<void> {
    await this.hasura.executeMutation(
      `mutation StampFallback(
        $id: uuid!, $deadline: timestamptz!, $at: timestamptz!
      ) {
        update_orders_by_pk(pk_columns: { id: $id }, _set: {
          auto_complete_deadline_at: $deadline
          delivery_proof_submitted_at: $at
          updated_at: $at
        }) { id }
      }`,
      { id: orderId, deadline: deadlineAt, at: submittedAt }
    );
  }

  async insertProofPhotos(
    orderId: string,
    agentId: string,
    photos: DeliveryProofPhotoInput[]
  ): Promise<void> {
    const objects = photos.map((p) => ({
      order_id: orderId,
      agent_id: agentId,
      photo_url: p.photoUrl,
      captured_at: p.capturedAt,
      latitude: p.latitude,
      longitude: p.longitude,
      note: p.note ?? null,
    }));
    await this.hasura.executeMutation(
      `mutation InsertDeliveryProofs(
        $objects: [order_delivery_proof_photos_insert_input!]!
      ) {
        insert_order_delivery_proof_photos(objects: $objects) { affected_rows }
      }`,
      { objects }
    );
  }

  async listProofPhotos(orderId: string): Promise<
    Array<{
      photo_url: string;
      captured_at: string;
      latitude?: number | null;
      longitude?: number | null;
      agent_id?: string | null;
    }>
  > {
    const res = await this.hasura.executeQuery<{
      order_delivery_proof_photos: Array<{
        photo_url: string;
        captured_at: string;
        latitude?: number | null;
        longitude?: number | null;
        agent_id?: string | null;
      }>;
    }>(
      `query DeliveryProofs($id: uuid!) {
        order_delivery_proof_photos(
          where: { order_id: { _eq: $id } }
          order_by: { created_at: asc }
        ) {
          photo_url captured_at latitude longitude agent_id
        }
      }`,
      { id: orderId }
    );
    return res.order_delivery_proof_photos ?? [];
  }

  async dueAutoComplete(nowIso: string, limit: number): Promise<string[]> {
    const res = await this.hasura.executeQuery<{
      orders: Array<{ id: string }>;
    }>(
      `query DueAutoComplete($now: timestamptz!, $limit: Int!) {
        orders(
          where: {
            current_status: { _eq: pending_auto_complete }
            auto_complete_deadline_at: { _lte: $now }
          }
          limit: $limit
        ) { id }
      }`,
      { now: nowIso, limit }
    );
    return (res.orders ?? []).map((o) => o.id);
  }

  async awaitingSince(beforeIso: string, limit: number): Promise<ClientConfirmOrder[]> {
    const res = await this.hasura.executeQuery<{
      orders: ClientConfirmOrder[];
    }>(
      `query AwaitingConfirmSince($before: timestamptz!, $limit: Int!) {
        orders(
          where: {
            current_status: { _eq: awaiting_client_confirmation }
            client_confirmation_requested_at: { _lte: $before }
          }
          limit: $limit
        ) { ${ORDER_FIELDS} }
      }`,
      { before: beforeIso, limit }
    );
    return res.orders ?? [];
  }

  async stampReminder(
    orderId: string,
    field: 'awaiting_confirm_reminder_1h_at' | 'awaiting_confirm_reminder_24h_at',
    at: string
  ): Promise<void> {
    await this.hasura.executeMutation(
      `mutation StampConfirmReminder($id: uuid!, $at: timestamptz!) {
        update_orders_by_pk(pk_columns: { id: $id }, _set: {
          ${field}: $at, updated_at: $at
        }) { id }
      }`,
      { id: orderId, at }
    );
  }

  async stampSupportTicket(orderId: string, ticketId: string, at: string): Promise<void> {
    await this.hasura.executeMutation(
      `mutation StampConfirmSupportTicket(
        $id: uuid!, $ticketId: uuid!, $at: timestamptz!
      ) {
        update_orders_by_pk(pk_columns: { id: $id }, _set: {
          awaiting_confirm_support_ticket_id: $ticketId, updated_at: $at
        }) { id }
      }`,
      { id: orderId, ticketId, at }
    );
  }
}
