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
  estimated_tax_amount: number;
  captured_total_including_tax: number | null;
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
            estimated_tax_amount
            captured_total_including_tax
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
            estimated_tax_amount: Number(snap.estimated_tax_amount ?? 0),
            captured_total_including_tax:
              snap.captured_total_including_tax == null
                ? null
                : Number(snap.captured_total_including_tax),
          }
        : null,
    };
  }

  /**
   * Insert the estimate, or refresh it while it is still `estimated` or `void` (a payment
   * retry takes a new calculation; a void snapshot that has never been captured is reopened).
   * A finalized snapshot is never overwritten. The order's `void` tax_status is reopened to
   * `estimated` in the same transaction.
   */
  async upsertEstimate(
    orderId: string,
    input: OrderTaxSnapshotInput
  ): Promise<void> {
    await this.hasura.executeMutation(
      `
      mutation UpsertOrderTaxSnapshot($object: order_tax_snapshots_insert_input!, $orderId: uuid!, $now: timestamptz!) {
        insert_order_tax_snapshots_one(
          object: $object
          on_conflict: {
            constraint: order_tax_snapshots_order_id_key
            update_columns: [
              status
              voided_at
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
            where: { status: { _in: ["estimated", "void"] } }
          }
        ) { id }
        update_orders(
          where: { id: { _eq: $orderId }, tax_status: { _eq: "void" } }
          _set: { tax_status: "estimated", updated_at: $now }
        ) { affected_rows }
      }
    `,
      {
        object: {
          order_id: orderId,
          status: 'estimated',
          voided_at: null,
          ...input,
          updated_at: new Date().toISOString(),
        },
        orderId,
        now: new Date().toISOString(),
      }
    );
  }

  /**
   * One transaction: snapshot estimated|void -> finalized, and the order's
   * tax_status/ids/breakdown. Both statements are guarded, so replays and the webhook path
   * are no-ops. `void` may finalize: a capture that really happened outranks an earlier
   * cancel/expiry. Totals on the order are deliberately not part of this write.
   */
  async markFinalized(params: {
    orderId: string;
    calculationId: string;
    taxTransactionId: string | null;
    capturedTotalIncludingTax: number | null;
    taxBreakdown: unknown;
    taxJurisdiction: unknown;
  }): Promise<{ snapshotsUpdated: number; ordersUpdated: number }> {
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
          where: { order_id: { _eq: $orderId }, status: { _in: ["estimated", "void"] } }
          _set: {
            status: "finalized"
            stripe_tax_transaction_id: $taxTransactionId
            captured_total_including_tax: $captured
            finalized_at: $now
            voided_at: null
            updated_at: $now
          }
        ) { affected_rows }
        update_orders(
          where: { id: { _eq: $orderId }, tax_status: { _in: ["estimated", "void"] } }
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
      ordersUpdated: res?.update_orders?.affected_rows ?? 0,
    };
  }

  /**
   * Heal an already-`finalized` snapshot / order that was finalized without a Stripe tax
   * transaction id (or without the captured total): fill only the NULL columns. Never
   * changes a value that is already set.
   */
  async fillFinalizedGaps(params: {
    orderId: string;
    taxTransactionId: string | null;
    capturedTotalIncludingTax: number | null;
  }): Promise<{ filled: number }> {
    const now = new Date().toISOString();
    const parts: string[] = [];
    const decls: string[] = ['$orderId: uuid!', '$now: timestamptz!'];
    const vars: Record<string, unknown> = { orderId: params.orderId, now };
    if (params.taxTransactionId) {
      decls.push('$txn: String!');
      vars.txn = params.taxTransactionId;
      parts.push(`
        fill_snapshot_txn: update_order_tax_snapshots(
          where: { order_id: { _eq: $orderId }, status: { _eq: "finalized" }, stripe_tax_transaction_id: { _is_null: true } }
          _set: { stripe_tax_transaction_id: $txn, updated_at: $now }
        ) { affected_rows }
        fill_order_txn: update_orders(
          where: { id: { _eq: $orderId }, tax_status: { _eq: "finalized" }, stripe_tax_transaction_id: { _is_null: true } }
          _set: { stripe_tax_transaction_id: $txn, updated_at: $now }
        ) { affected_rows }`);
    }
    if (params.capturedTotalIncludingTax != null) {
      decls.push('$captured: numeric!');
      vars.captured = params.capturedTotalIncludingTax;
      parts.push(`
        fill_snapshot_captured: update_order_tax_snapshots(
          where: { order_id: { _eq: $orderId }, status: { _eq: "finalized" }, captured_total_including_tax: { _is_null: true } }
          _set: { captured_total_including_tax: $captured, updated_at: $now }
        ) { affected_rows }`);
    }
    if (parts.length === 0) return { filled: 0 };
    const res = await this.hasura.executeMutation(
      `mutation FillOrderTaxGaps(${decls.join(', ')}) {${parts.join('')}
      }`,
      vars
    );
    const filled = Object.values(res ?? {}).reduce(
      (sum: number, r: any) => sum + Number(r?.affected_rows ?? 0),
      0
    );
    return { filled };
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
  ): Promise<{
    alreadyReversed: boolean;
    reversedMinor: number;
    refundIds: string[];
  }> {
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
      refundIds: rows.map((r) => r.stripe_refund_id),
    };
  }

  /**
   * Order numbers whose tax state looks unfinished, oldest first:
   *  - `estimated`/`void` but paid (captured money, snapshot never finalized);
   *  - `finalized` whose snapshot has no Stripe tax transaction id (cannot be reversed);
   *  - `finalized` with a succeeded refund but no reversal row at all.
   * `olderThanMinutes` leaves in-flight captures/webhooks alone.
   */
  async listReconcileCandidates(
    limit: number,
    olderThanMinutes: number
  ): Promise<string[]> {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60_000).toISOString();
    const res = await this.hasura.executeQuery(
      `
      query OrderTaxReconcileCandidates($limit: Int!, $cutoff: timestamptz!) {
        orders(
          where: {
            updated_at: { _lt: $cutoff }
            _or: [
              { tax_status: { _in: ["estimated", "void"] }, payment_status: { _eq: "paid" } }
              { tax_status: { _eq: "finalized" }, tax_snapshot: { stripe_tax_transaction_id: { _is_null: true } } }
              {
                tax_status: { _eq: "finalized" }
                tax_snapshot: { status: { _eq: "finalized" }, _not: { reversals: {} } }
                stripe_refunds: { status: { _eq: "succeeded" } }
              }
            ]
          }
          order_by: { updated_at: asc }
          limit: $limit
        ) { order_number }
      }
    `,
      { limit, cutoff }
    );
    return (res?.orders ?? []).map((o: { order_number: string }) => o.order_number);
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
