import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type { OrderTaxSnapshotInput } from './order-tax-snapshot.util';

export type SnapshotStatus = 'estimated' | 'finalized' | 'void';

export interface OrderTaxSnapshotRow {
  id: string;
  status: SnapshotStatus;
  currency: string;
  stripe_tax_calculation_id: string;
  stripe_tax_transaction_id: string | null;
  total_including_tax: number;
}

export interface OrderTaxContext {
  order: { id: string; currency: string; tax_status: string };
  snapshot: OrderTaxSnapshotRow | null;
}

export interface OrderTaxReversalInput {
  snapshotId: string;
  orderId: string;
  stripeRefundId: string;
  stripeTaxReversalId: string | null;
  reference: string;
  mode: 'full' | 'partial';
  amountMinor: number;
  currency: string;
}

/**
 * Hasura access for public.order_tax_snapshots / order_tax_reversals and the
 * tax_status bookkeeping on public.orders. It never writes orders.total_amount,
 * orders.tax_amount or orders.pre_tax_total.
 */
@Injectable()
export class OrderTaxSnapshotRepository {
  constructor(private readonly hasura: HasuraSystemService) {}

  async getContextByOrderNumber(
    orderNumber: string
  ): Promise<OrderTaxContext | null> {
    const res = await this.hasura.executeQuery(
      `
      query OrderTaxContext($orderNumber: String!) {
        orders(where: { order_number: { _eq: $orderNumber } }, limit: 1) {
          id
          currency
          tax_status
          tax_snapshot {
            id
            status
            currency
            stripe_tax_calculation_id
            stripe_tax_transaction_id
            total_including_tax
          }
        }
      }
    `,
      { orderNumber }
    );
    const row = res?.orders?.[0];
    if (!row) return null;
    const snap = row.tax_snapshot;
    return {
      order: { id: row.id, currency: row.currency, tax_status: row.tax_status },
      snapshot: snap
        ? {
            ...snap,
            total_including_tax: Number(snap.total_including_tax),
          }
        : null,
    };
  }

  /**
   * Insert the estimate, or refresh it while it is still `estimated` (a payment retry
   * takes a new calculation). A finalized/void snapshot is never overwritten.
   */
  async upsertEstimate(
    orderId: string,
    input: OrderTaxSnapshotInput
  ): Promise<void> {
    await this.hasura.executeMutation(
      `
      mutation UpsertOrderTaxSnapshot($object: order_tax_snapshots_insert_input!) {
        insert_order_tax_snapshots_one(
          object: $object
          on_conflict: {
            constraint: order_tax_snapshots_order_id_key
            update_columns: [
              currency
              stripe_tax_calculation_id
              estimated_tax_amount
              pre_tax_amount
              total_including_tax
              effective_tax_rate
              tax_breakdown
              tax_jurisdiction
              updated_at
            ]
            where: { status: { _eq: "estimated" } }
          }
        ) { id }
      }
    `,
      {
        object: {
          order_id: orderId,
          status: 'estimated',
          ...input,
          updated_at: new Date().toISOString(),
        },
      }
    );
  }

  /**
   * One transaction: snapshot estimated -> finalized, and the order's tax_status/ids/breakdown.
   * Both statements are guarded on `estimated`, so replays and the webhook path are no-ops.
   * Totals on the order are deliberately not part of this write.
   */
  async markFinalized(params: {
    orderId: string;
    calculationId: string;
    taxTransactionId: string | null;
    capturedTotalIncludingTax: number | null;
    taxBreakdown: unknown;
    taxJurisdiction: unknown;
  }): Promise<{ snapshotsUpdated: number }> {
    const now = new Date().toISOString();
    const res = await this.hasura.executeMutation(
      `
      mutation FinalizeOrderTaxSnapshot(
        $orderId: uuid!
        $calculationId: String!
        $taxTransactionId: String
        $captured: numeric
        $breakdown: jsonb
        $jurisdiction: jsonb
        $now: timestamptz!
      ) {
        update_order_tax_snapshots(
          where: { order_id: { _eq: $orderId }, status: { _eq: "estimated" } }
          _set: {
            status: "finalized"
            stripe_tax_transaction_id: $taxTransactionId
            captured_total_including_tax: $captured
            finalized_at: $now
            updated_at: $now
          }
        ) { affected_rows }
        update_orders(
          where: { id: { _eq: $orderId }, tax_status: { _eq: "estimated" } }
          _set: {
            tax_status: "finalized"
            stripe_tax_calculation_id: $calculationId
            stripe_tax_transaction_id: $taxTransactionId
            tax_breakdown: $breakdown
            tax_jurisdiction: $jurisdiction
            updated_at: $now
          }
        ) { affected_rows }
      }
    `,
      {
        orderId: params.orderId,
        calculationId: params.calculationId,
        taxTransactionId: params.taxTransactionId,
        captured: params.capturedTotalIncludingTax,
        breakdown: params.taxBreakdown ?? null,
        jurisdiction: params.taxJurisdiction ?? null,
        now,
      }
    );
    return {
      snapshotsUpdated: res?.update_order_tax_snapshots?.affected_rows ?? 0,
    };
  }

  /** estimated -> void on both the snapshot and the order. Finalized rows are untouched. */
  async markVoid(orderId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.hasura.executeMutation(
      `
      mutation VoidOrderTax($orderId: uuid!, $now: timestamptz!) {
        update_order_tax_snapshots(
          where: { order_id: { _eq: $orderId }, status: { _eq: "estimated" } }
          _set: { status: "void", voided_at: $now, updated_at: $now }
        ) { affected_rows }
        update_orders(
          where: { id: { _eq: $orderId }, tax_status: { _eq: "estimated" } }
          _set: { tax_status: "void", updated_at: $now }
        ) { affected_rows }
      }
    `,
      { orderId, now }
    );
  }

  async getReversalState(
    snapshotId: string,
    stripeRefundId: string
  ): Promise<{ alreadyReversed: boolean; reversedMinor: number }> {
    const res = await this.hasura.executeQuery(
      `
      query OrderTaxReversals($snapshotId: uuid!) {
        order_tax_reversals(where: { snapshot_id: { _eq: $snapshotId } }) {
          stripe_refund_id
          amount_minor
        }
      }
    `,
      { snapshotId }
    );
    const rows: Array<{ stripe_refund_id: string; amount_minor: number | string }> =
      res?.order_tax_reversals ?? [];
    return {
      alreadyReversed: rows.some((r) => r.stripe_refund_id === stripeRefundId),
      reversedMinor: rows.reduce((sum, r) => sum + Number(r.amount_minor), 0),
    };
  }

  async insertReversal(input: OrderTaxReversalInput): Promise<void> {
    await this.hasura.executeMutation(
      `
      mutation InsertOrderTaxReversal($object: order_tax_reversals_insert_input!) {
        insert_order_tax_reversals_one(
          object: $object
          on_conflict: { constraint: order_tax_reversals_stripe_refund_id_key, update_columns: [] }
        ) { id }
      }
    `,
      {
        object: {
          snapshot_id: input.snapshotId,
          order_id: input.orderId,
          stripe_refund_id: input.stripeRefundId,
          stripe_tax_reversal_id: input.stripeTaxReversalId,
          reference: input.reference,
          mode: input.mode,
          amount_minor: input.amountMinor,
          currency: input.currency,
        },
      }
    );
  }
}
