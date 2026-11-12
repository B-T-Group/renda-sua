import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { StripeConfig } from '../config/configuration';
import { OrderSystemJobsService } from '../orders/order-system-jobs.service';
import { StripePaymentsDatabaseService } from './stripe-payments-database.service';
import { StripeService } from './stripe.service';

interface StaleAuthorizedOrderRow {
  id: string;
  order_number: string;
  payment_status: string;
  current_status: string;
  updated_at: string;
}

@Injectable()
export class StripeAuthReconcilerService {
  private readonly logger = new Logger(StripeAuthReconcilerService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly databaseService: StripePaymentsDatabaseService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
    private readonly orderSystemJobsService: OrderSystemJobsService
  ) {}

  private get config(): StripeConfig {
    return this.configService.get<StripeConfig>('stripe') as StripeConfig;
  }

  /** Reconcile Stripe PI status with platform records every 15 minutes. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async reconcileAuthorizedPayments(): Promise<void> {
    if (!this.config.manualCaptureEnabled) return;

    await this.reconcilePendingTransactions();
    await this.expireStaleAuthorizedOrders();
    await this.flagExpiredAssignedAuthorizations();
  }

  private async reconcilePendingTransactions(): Promise<void> {
    const query = `
      query StaleStripeTxs {
        stripe_payment_transactions(
          where: {
            capture_method: { _eq: "manual" }
            status: { _in: ["pending", "authorized", "capture_pending"] }
            payment_entity: { _in: ["order", "rental_booking"] }
          }
          limit: 50
        ) {
          id
          reference
          entity_id
          payment_entity
          stripe_payment_intent_id
          status
        }
      }
    `;
    try {
      const response = await this.hasuraSystemService.executeQuery(query, {});
      const rows = response.stripe_payment_transactions ?? [];
      for (const row of rows) {
        if (!row.stripe_payment_intent_id) continue;
        await this.syncTransactionFromStripe(
          row.id,
          row.stripe_payment_intent_id,
          row.entity_id ?? row.reference,
          row.payment_entity
        );
      }
    } catch (error: any) {
      this.logger.error(`Reconcile pending txs failed: ${error?.message}`);
    }
  }

  private async syncTransactionFromStripe(
    txId: string,
    paymentIntentId: string,
    entityId?: string,
    paymentEntity?: string
  ): Promise<void> {
    try {
      const pi = await this.stripeService.retrievePaymentIntent(paymentIntentId);
      if (pi.status === 'requires_capture' && pi.amount_capturable > 0) {
        await this.markStripeTxAuthorized(txId);
        return;
      }
      if (pi.status !== 'canceled') return;
      await this.handleCanceledStripeAuthorization(txId, entityId, paymentEntity);
    } catch (error: any) {
      this.logger.warn(
        `Could not sync PI ${paymentIntentId}: ${error?.message}`
      );
    }
  }

  private async markStripeTxAuthorized(txId: string): Promise<void> {
    const tx = await this.databaseService.getTransactionById(txId);
    if (tx?.status !== 'pending') return;
    await this.databaseService.updateTransaction(txId, {
      status: 'authorized',
      authorized_at: new Date().toISOString(),
    });
  }

  private async handleCanceledStripeAuthorization(
    txId: string,
    entityId: string | undefined,
    paymentEntity: string | undefined
  ): Promise<void> {
    if (entityId && paymentEntity === 'rental_booking') {
      await this.handleRentalAuthorizationLapsed(entityId);
    } else if (entityId) {
      await this.handleStripeAuthorizationLapsed(entityId);
    }
    await this.databaseService.updateTransaction(txId, {
      status: 'expired',
      error_message: 'Payment authorization expired or cancelled',
    });
  }

  /**
   * A lapsed card hold on a rental that has not started is cancelled.
   * Card bookings leave `proposed` as soon as the authorization is recorded,
   * so `confirmed` with no `actual_start_at` is still before handover.
   * Once the item is out, the booking stays open and support is told once.
   * A lost cancel throws so the transaction stays eligible for the next run.
   */
  private async handleRentalAuthorizationLapsed(
    bookingNumber: string
  ): Promise<void> {
    const booking = await this.fetchAuthorizedRental(bookingNumber);
    if (!booking) return;
    if (this.rentalUnstarted(booking)) {
      await this.cancelUnstartedRentalAfterLapse(booking);
      return;
    }
    if (!this.rentalStillOut(booking.status)) return;
    await this.noteRentalAuthLapsed(booking);
  }

  private rentalUnstarted(booking: {
    status: string;
    actual_start_at?: string | null;
  }): boolean {
    if (booking.actual_start_at) return false;
    return (
      booking.status === 'proposed' ||
      booking.status === 'reserved' ||
      booking.status === 'confirmed'
    );
  }

  private rentalStillOut(status: string): boolean {
    return (
      status === 'confirmed' ||
      status === 'active' ||
      status === 'awaiting_return'
    );
  }

  private async fetchAuthorizedRental(bookingNumber: string) {
    const response = await this.hasuraSystemService.executeQuery<{
      rental_bookings: Array<{
        id: string;
        booking_number: string;
        status: string;
        payment_status: string;
        actual_start_at?: string | null;
      }>;
    }>(
      `query AuthorizedRental($bookingNumber: String!) {
        rental_bookings(
          where: { booking_number: { _eq: $bookingNumber } }
          limit: 1
        ) { id booking_number status payment_status actual_start_at }
      }`,
      { bookingNumber }
    );
    const booking = response.rental_bookings?.[0];
    if (!booking || booking.payment_status !== 'authorized') return null;
    return booking;
  }

  private async cancelUnstartedRentalAfterLapse(booking: {
    id: string;
    booking_number: string;
    status: string;
  }): Promise<void> {
    const result = await this.hasuraSystemService.executeMutation<{
      update_rental_bookings: { affected_rows: number } | null;
    }>(
      `mutation CancelUnstartedRental($id: uuid!, $status: rental_booking_status_enum!) {
        update_rental_bookings(
          where: {
            id: { _eq: $id }
            status: { _eq: $status }
            actual_start_at: { _is_null: true }
            payment_status: { _eq: authorized }
          }
          _set: { status: cancelled, payment_status: cancelled, contract_expires_at: null }
        ) { affected_rows }
      }`,
      { id: booking.id, status: booking.status }
    );
    if ((result.update_rental_bookings?.affected_rows ?? 0) !== 1) {
      throw new Error(
        `Could not cancel unstarted rental ${booking.booking_number} after the card authorization lapsed`
      );
    }
    await this.insertRentalLapseNote(booking.id, booking.status);
  }

  private async noteRentalAuthLapsed(booking: {
    id: string;
    booking_number: string;
    status: string;
  }): Promise<void> {
    this.logger.warn(
      `stripe_auth_lapsed_rental booking=${booking.booking_number} id=${booking.id} status=${booking.status}`
    );
    if (await this.rentalLapseNoted(booking.id)) return;
    await this.insertRentalLapseNote(booking.id, booking.status);
  }

  private async rentalLapseNoted(bookingId: string): Promise<boolean> {
    const response = await this.hasuraSystemService.executeQuery<{
      rental_status_history: Array<{ id: string }>;
    }>(
      `query RentalLapseNote($id: uuid!) {
        rental_status_history(
          where: {
            rental_booking_id: { _eq: $id }
            notes: { _eq: "Stripe authorization lapsed" }
          }
          limit: 1
        ) { id }
      }`,
      { id: bookingId }
    );
    return (response.rental_status_history?.length ?? 0) > 0;
  }

  private async insertRentalLapseNote(
    bookingId: string,
    status: string
  ): Promise<void> {
    await this.hasuraSystemService.executeMutation(
      `mutation NoteRentalLapse($object: rental_status_history_insert_input!) {
        insert_rental_status_history_one(object: $object) { id }
      }`,
      {
        object: {
          rental_booking_id: bookingId,
          status,
          previous_status: status,
          changed_by_user_id: null,
          changed_by_type: 'system',
          notes: 'Stripe authorization lapsed',
        },
      }
    );
  }

  private async handleStripeAuthorizationLapsed(
    orderNumber: string
  ): Promise<void> {
    const query = `
      query AssignedAuthorizedOrder($orderNumber: String!) {
        orders(where: { order_number: { _eq: $orderNumber } }, limit: 1) {
          id
          order_number
          current_status
          payment_status
        }
      }
    `;
    try {
      const response = await this.hasuraSystemService.executeQuery(query, {
        orderNumber,
      });
      const order = response.orders?.[0];
      if (!order) return;
      if (order.payment_status !== 'authorized') return;
      if (order.current_status !== 'assigned_to_agent') return;

      this.logger.warn(
        `stripe_auth_lapsed_assigned order=${order.order_number} id=${order.id}`
      );
      await this.orderSystemJobsService.onOrderPaymentFailed(
        order.id,
        'Payment authorization expired before pickup'
      );
    } catch (error: any) {
      this.logger.error(
        `handleStripeAuthorizationLapsed failed for ${orderNumber}: ${error?.message}`
      );
    }
  }

  /** Orders assigned to an agent but still authorized — surface if auth is stale. */
  private async flagExpiredAssignedAuthorizations(): Promise<void> {
    const query = `
      query AssignedAuthorizedOrders {
        orders(
          where: {
            payment_status: { _eq: "authorized" }
            payment_source: { _eq: credit_card }
            current_status: { _eq: "assigned_to_agent" }
          }
          limit: 20
        ) {
          id
          order_number
          payment_authorized_at
        }
      }
    `;
    try {
      const response = await this.hasuraSystemService.executeQuery(query, {});
      const orders = response.orders ?? [];
      for (const order of orders) {
        const tx = await this.databaseService.getTransactionByEntityId(
          order.order_number
        );
        if (tx?.status === 'expired' || tx?.status === 'cancelled') {
          this.logger.warn(
            `Assigned order ${order.order_number} has lapsed Stripe authorization`
          );
          await this.orderSystemJobsService.onOrderPaymentFailed(
            order.id,
            'Payment authorization expired before pickup'
          );
        }
      }
    } catch (error: any) {
      this.logger.error(
        `flagExpiredAssignedAuthorizations failed: ${error?.message}`
      );
    }
  }

  private async expireStaleAuthorizedOrders(): Promise<void> {
    const noAgentHours = this.config.authorizedNoAgentTimeoutHours ?? 48;
    const cutoff = new Date(
      Date.now() - noAgentHours * 60 * 60 * 1000
    ).toISOString();

    const query = `
      query StaleAuthorizedOrders($cutoff: timestamptz!) {
        orders(
          where: {
            payment_status: { _eq: "authorized" }
            payment_source: { _eq: credit_card }
            current_status: { _eq: "ready_for_pickup" }
            assigned_agent_id: { _is_null: true }
            fulfillment_method: { _neq: pickup }
            updated_at: { _lt: $cutoff }
          }
          limit: 20
        ) {
          id
          order_number
          payment_status
          current_status
          updated_at
        }
      }
    `;
    try {
      const response = await this.hasuraSystemService.executeQuery(query, {
        cutoff,
      });
      const orders: StaleAuthorizedOrderRow[] = response.orders ?? [];
      for (const order of orders) {
        await this.cancelStaleOrder(order);
      }
    } catch (error: any) {
      this.logger.error(`Expire stale authorized orders failed: ${error?.message}`);
    }
  }

  private async cancelStaleOrder(order: StaleAuthorizedOrderRow): Promise<void> {
    this.logger.log(
      `Auto-cancelling stale authorized order ${order.order_number} (no agent)`
    );
    await this.orderSystemJobsService.cancelStaleAuthorizedOrderAsSystem(order.id);
  }
}
