import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type { DeliveryConfirmationMethod } from './client-confirm-delivery.constants';
import type {
  ClientConfirmOrder,
  DeliveryProofPhotoInput,
  DeliveryReportInput,
} from './client-confirm-delivery.types';
import type { DeliveryReportOutcome } from './client-confirm-delivery.constants';

export interface DeliveryReportRow {
  id: string;
  order_id: string;
  client_id: string;
  report_type: string;
  reason: string;
  note?: string | null;
  photo_urls?: string[] | null;
  phase: string;
  support_ticket_id?: string | null;
  outcome: string;
  resolution?: string | null;
  admin_note?: string | null;
  resolved_at?: string | null;
  created_at: string;
}

const ORDER_FIELDS = `
  id order_number current_status fulfillment_method fulfillment_country
  payment_timing payment_method payment_status payment_source
  pay_after_merchant_confirm reconciliation_status
  total_amount deposit_amount deposit_status
  delivery_pin_hash delivery_confirmation_method
  client_confirmation_requested_at client_confirmed_at
  auto_complete_deadline_at delivery_proof_submitted_at
  awaiting_confirm_reminder_1h_at awaiting_confirm_reminder_24h_at
  awaiting_confirm_support_ticket_id
  delivered_at completed_at report_window_ends_at
  dispute_type dispute_reason dispute_opened_at
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

  /** Agent tapped Delivered: requested/delivered timestamps; MoMo also freezes the deadline. */
  async stampDelivered(
    orderId: string,
    at: string,
    deadlineAt: string | null
  ): Promise<void> {
    await this.hasura.executeMutation(
      `mutation StampDelivered(
        $id: uuid!, $at: timestamptz!, $deadline: timestamptz
      ) {
        update_orders_by_pk(pk_columns: { id: $id }, _set: {
          client_confirmation_requested_at: $at
          delivered_at: $at
          auto_complete_deadline_at: $deadline
          awaiting_confirm_reminder_1h_at: null
          updated_at: $at
        }) { id }
      }`,
      { id: orderId, at, deadline: deadlineAt }
    );
  }

  /** Complete straight from out_for_delivery: delivered_at = completion time (once). */
  async stampDeliveredIfMissing(orderId: string, at: string): Promise<void> {
    await this.hasura.executeMutation(
      `mutation StampDeliveredIfMissing($id: uuid!, $at: timestamptz!) {
        update_orders(
          where: { id: { _eq: $id }, delivered_at: { _is_null: true } }
          _set: { delivered_at: $at }
        ) { affected_rows }
      }`,
      { id: orderId, at }
    );
  }

  async stampReportWindow(orderId: string, endsAt: string): Promise<void> {
    await this.hasura.executeMutation(
      `mutation StampReportWindow($id: uuid!, $ends: timestamptz!) {
        update_orders(
          where: { id: { _eq: $id }, report_window_ends_at: { _is_null: true } }
          _set: { report_window_ends_at: $ends }
        ) { affected_rows }
      }`,
      { id: orderId, ends: endsAt }
    );
  }

  /** In-flight MoMo orders (awaiting, no deadline yet). Rail is checked by the caller. */
  async awaitingWithoutDeadline(limit: number): Promise<ClientConfirmOrder[]> {
    const res = await this.hasura.executeQuery<{ orders: ClientConfirmOrder[] }>(
      `query AwaitingNoDeadline($limit: Int!) {
        orders(
          where: {
            current_status: { _eq: awaiting_client_confirmation }
            auto_complete_deadline_at: { _is_null: true }
            dispute_opened_at: { _is_null: true }
          }
          order_by: { updated_at: asc }
          limit: $limit
        ) { ${ORDER_FIELDS} }
      }`,
      { limit }
    );
    return res.orders ?? [];
  }

  /** CAS: only sets a deadline that is still missing. Clears a never-sent legacy 1h stamp. */
  async backfillDeadline(
    orderId: string,
    deliveredAt: string,
    deadlineAt: string,
    at: string
  ): Promise<boolean> {
    const res = await this.hasura.executeMutation<{
      update_orders: { affected_rows: number };
    }>(
      `mutation BackfillDeadline(
        $id: uuid!, $delivered: timestamptz!, $deadline: timestamptz!, $at: timestamptz!
      ) {
        update_orders(
          where: {
            id: { _eq: $id }
            current_status: { _eq: awaiting_client_confirmation }
            auto_complete_deadline_at: { _is_null: true }
          }
          _set: {
            delivered_at: $delivered
            auto_complete_deadline_at: $deadline
            awaiting_confirm_reminder_1h_at: null
            updated_at: $at
          }
        ) { affected_rows }
      }`,
      { id: orderId, delivered: deliveredAt, deadline: deadlineAt, at }
    );
    return (res.update_orders?.affected_rows ?? 0) > 0;
  }

  async dueMomoAutoComplete(nowIso: string, limit: number): Promise<string[]> {
    const res = await this.hasura.executeQuery<{ orders: Array<{ id: string }> }>(
      `query DueMomoAutoComplete($now: timestamptz!, $limit: Int!) {
        orders(
          where: {
            current_status: { _eq: awaiting_client_confirmation }
            auto_complete_deadline_at: { _lte: $now }
            dispute_opened_at: { _is_null: true }
          }
          order_by: { auto_complete_deadline_at: asc }
          limit: $limit
        ) { id }
      }`,
      { now: nowIso, limit }
    );
    return (res.orders ?? []).map((o) => o.id);
  }

  /** Awaiting orders with a deadline whose reminder has not gone out. */
  async pendingMomoReminders(
    latestDeadlineIso: string,
    limit: number
  ): Promise<ClientConfirmOrder[]> {
    const res = await this.hasura.executeQuery<{ orders: ClientConfirmOrder[] }>(
      `query PendingMomoReminders($latest: timestamptz!, $limit: Int!) {
        orders(
          where: {
            current_status: { _eq: awaiting_client_confirmation }
            auto_complete_deadline_at: { _lte: $latest }
            awaiting_confirm_reminder_1h_at: { _is_null: true }
            dispute_opened_at: { _is_null: true }
          }
          order_by: { auto_complete_deadline_at: asc }
          limit: $limit
        ) { ${ORDER_FIELDS} }
      }`,
      { latest: latestDeadlineIso, limit }
    );
    return res.orders ?? [];
  }

  /** CAS claim so exactly one worker sends the reminder. */
  async claimReminder(orderId: string, at: string): Promise<boolean> {
    const res = await this.hasura.executeMutation<{
      update_orders: { affected_rows: number };
    }>(
      `mutation ClaimMomoReminder($id: uuid!, $at: timestamptz!) {
        update_orders(
          where: {
            id: { _eq: $id }
            current_status: { _eq: awaiting_client_confirmation }
            awaiting_confirm_reminder_1h_at: { _is_null: true }
          }
          _set: { awaiting_confirm_reminder_1h_at: $at }
        ) { affected_rows }
      }`,
      { id: orderId, at }
    );
    return (res.update_orders?.affected_rows ?? 0) > 0;
  }

  /** First report wins; later reports keep the original dispute fields. */
  async openDispute(
    orderId: string,
    type: string,
    reason: string,
    at: string
  ): Promise<void> {
    await this.hasura.executeMutation(
      `mutation OpenDeliveryDispute(
        $id: uuid!, $type: String!, $reason: String!, $at: timestamptz!
      ) {
        update_orders(
          where: { id: { _eq: $id }, dispute_opened_at: { _is_null: true } }
          _set: {
            dispute_type: $type, dispute_reason: $reason
            dispute_opened_at: $at, updated_at: $at
          }
        ) { affected_rows }
      }`,
      { id: orderId, type, reason, at }
    );
  }

  async insertReport(params: {
    orderId: string;
    clientId: string;
    reporterUserId: string | null;
    input: DeliveryReportInput;
    phase: 'pre_completion' | 'post_completion';
    ticketId: string | null;
  }): Promise<string | null> {
    const res = await this.hasura.executeMutation<{
      insert_order_delivery_reports_one: { id: string } | null;
    }>(
      `mutation InsertDeliveryReport($object: order_delivery_reports_insert_input!) {
        insert_order_delivery_reports_one(object: $object) { id }
      }`,
      {
        object: {
          order_id: params.orderId,
          client_id: params.clientId,
          reporter_user_id: params.reporterUserId,
          report_type: params.input.type,
          reason: params.input.reason,
          note: params.input.note?.trim() || null,
          photo_urls: params.input.photoUrls ?? [],
          item_ids: params.input.itemIds ?? [],
          phase: params.phase,
          support_ticket_id: params.ticketId,
        },
      }
    );
    return res.insert_order_delivery_reports_one?.id ?? null;
  }

  async listReportsForOrder(orderId: string): Promise<DeliveryReportRow[]> {
    const res = await this.hasura.executeQuery<{
      order_delivery_reports: DeliveryReportRow[];
    }>(
      `query OrderDeliveryReports($id: uuid!) {
        order_delivery_reports(
          where: { order_id: { _eq: $id } }
          order_by: { created_at: asc }
        ) {
          id order_id client_id report_type reason note photo_urls phase
          support_ticket_id outcome resolution admin_note resolved_at created_at
        }
      }`,
      { id: orderId }
    );
    return res.order_delivery_reports ?? [];
  }

  async countUnsupportedReports(clientId: string, sinceIso: string): Promise<number> {
    const res = await this.hasura.executeQuery<{
      order_delivery_reports_aggregate: { aggregate: { count: number } };
    }>(
      `query UnsupportedReports($client: uuid!, $since: timestamptz!) {
        order_delivery_reports_aggregate(where: {
          client_id: { _eq: $client }
          outcome: { _eq: "unsupported" }
          created_at: { _gte: $since }
        }) { aggregate { count } }
      }`,
      { client: clientId, since: sinceIso }
    );
    return res.order_delivery_reports_aggregate?.aggregate?.count ?? 0;
  }

  /** Resolves every still-pending report on the order. */
  async resolveReports(params: {
    orderId: string;
    outcome: DeliveryReportOutcome;
    resolution: string;
    adminUserId: string;
    note?: string | null;
    at: string;
  }): Promise<number> {
    const res = await this.hasura.executeMutation<{
      update_order_delivery_reports: { affected_rows: number };
    }>(
      `mutation ResolveDeliveryReports(
        $id: uuid!, $outcome: String!, $resolution: String!,
        $by: uuid!, $note: String, $at: timestamptz!
      ) {
        update_order_delivery_reports(
          where: { order_id: { _eq: $id }, outcome: { _eq: "pending" } }
          _set: {
            outcome: $outcome, resolution: $resolution, resolved_by: $by,
            admin_note: $note, resolved_at: $at
          }
        ) { affected_rows }
      }`,
      {
        id: params.orderId,
        outcome: params.outcome,
        resolution: params.resolution,
        by: params.adminUserId,
        note: params.note ?? null,
        at: params.at,
      }
    );
    return res.update_order_delivery_reports?.affected_rows ?? 0;
  }
}
