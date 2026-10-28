import { OrderTaxSnapshotRepository } from './order-tax-snapshot.repository';

describe('OrderTaxSnapshotRepository', () => {
  let hasura: { executeQuery: jest.Mock; executeMutation: jest.Mock };
  let repo: OrderTaxSnapshotRepository;

  beforeEach(() => {
    hasura = { executeQuery: jest.fn(), executeMutation: jest.fn().mockResolvedValue({}) };
    repo = new OrderTaxSnapshotRepository(hasura as never);
  });

  const allDocs = () =>
    [...hasura.executeMutation.mock.calls, ...hasura.executeQuery.mock.calls].map((c) => String(c[0]));

  it('reads the order with its snapshot and numeric-coerces the total', async () => {
    hasura.executeQuery.mockResolvedValue({
      orders: [
        {
          id: 'o-1',
          currency: 'CAD',
          tax_status: 'estimated',
          tax_snapshot: {
            id: 's-1',
            status: 'estimated',
            currency: 'CAD',
            stripe_tax_calculation_id: 'taxcalc_1',
            stripe_tax_transaction_id: null,
            total_including_tax: '113.00',
            estimated_tax_amount: '13.00',
            captured_total_including_tax: '113.00',
          },
        },
      ],
    });
    const ctx = await repo.getContextByOrderNumber('ORD-1');
    expect(ctx?.snapshot?.total_including_tax).toBe(113);
    expect(ctx?.snapshot?.estimated_tax_amount).toBe(13);
    expect(ctx?.snapshot?.captured_total_including_tax).toBe(113);
    expect(hasura.executeQuery).toHaveBeenCalledWith(expect.stringContaining('tax_snapshot'), {
      orderNumber: 'ORD-1',
    });
  });

  it('returns null for an unknown order and a null snapshot for a row without one', async () => {
    hasura.executeQuery.mockResolvedValueOnce({ orders: [] });
    expect(await repo.getContextByOrderNumber('X')).toBeNull();
    hasura.executeQuery.mockResolvedValueOnce({
      orders: [{ id: 'o-1', currency: 'CAD', tax_status: 'none', tax_snapshot: null }],
    });
    expect((await repo.getContextByOrderNumber('X'))?.snapshot).toBeNull();
  });

  it('upsert only refreshes a snapshot that is still estimated or void, and reopens a void order', async () => {
    await repo.upsertEstimate('o-1', {
      currency: 'CAD',
      stripe_tax_calculation_id: 'taxcalc_1',
      estimated_tax_amount: 13,
      pre_tax_amount: 100,
      total_including_tax: 113,
      effective_tax_rate: 13,
      tax_breakdown: [],
      tax_jurisdiction: null,
    });
    const [doc, vars] = hasura.executeMutation.mock.calls[0];
    expect(doc).toContain('constraint: order_tax_snapshots_order_id_key');
    expect(doc).toContain('where: { status: { _in: ["estimated", "void"] } }');
    expect(doc).not.toMatch(/update_columns:[^\]]*\b(stripe_tax_transaction_id|captured_total_including_tax|finalized_at|order_id)\b/);
    expect(doc).toContain('tax_status: { _eq: "void" }');
    expect(doc).toContain('_set: { tax_status: "estimated"');
    expect(vars.object).toMatchObject({
      order_id: 'o-1',
      status: 'estimated',
      voided_at: null,
      total_including_tax: 113,
    });
    expect(vars.orderId).toBe('o-1');
  });

  it('finalize is one guarded mutation with no order totals', async () => {
    hasura.executeMutation.mockResolvedValue({
      update_order_tax_snapshots: { affected_rows: 1 },
      update_orders: { affected_rows: 1 },
    });
    const res = await repo.markFinalized({
      orderId: 'o-1',
      calculationId: 'taxcalc_1',
      taxTransactionId: 'tax_txn_1',
      capturedTotalIncludingTax: 113,
      taxBreakdown: [],
      taxJurisdiction: null,
    });
    expect(res).toEqual({ snapshotsUpdated: 1, ordersUpdated: 1 });
    expect(hasura.executeMutation).toHaveBeenCalledTimes(1);
    const doc: string = hasura.executeMutation.mock.calls[0][0];
    // Both sides may finalize from estimated OR void (void is not terminal), never from finalized.
    expect(doc).toContain('status: { _in: ["estimated", "void"] }');
    expect(doc).toContain('tax_status: { _in: ["estimated", "void"] }');
    expect(doc).not.toMatch(/_eq: "finalized"/);
  });

  it('fillFinalizedGaps only fills NULL columns of a finalized snapshot/order', async () => {
    hasura.executeMutation.mockResolvedValue({
      fill_snapshot_txn: { affected_rows: 1 },
      fill_order_txn: { affected_rows: 1 },
      fill_snapshot_captured: { affected_rows: 1 },
    });
    const res = await repo.fillFinalizedGaps({
      orderId: 'o-1',
      taxTransactionId: 'tax_txn_1',
      capturedTotalIncludingTax: 113,
    });
    expect(res.filled).toBe(3);
    const doc: string = hasura.executeMutation.mock.calls[0][0];
    expect(doc.match(/stripe_tax_transaction_id: \{ _is_null: true \}/g)).toHaveLength(2);
    expect(doc).toContain('captured_total_including_tax: { _is_null: true }');
    expect(doc.match(/status: \{ _eq: "finalized" \}|tax_status: \{ _eq: "finalized" \}/g)).toHaveLength(3);
  });

  it('fillFinalizedGaps with nothing to fill does not call Hasura', async () => {
    expect(await repo.fillFinalizedGaps({ orderId: 'o', taxTransactionId: null, capturedTotalIncludingTax: null })).toEqual({
      filled: 0,
    });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('lists reconcile candidates oldest first with the in-flight cutoff', async () => {
    hasura.executeQuery.mockResolvedValue({ orders: [{ order_number: 'ORD-1' }, { order_number: 'ORD-2' }] });
    expect(await repo.listReconcileCandidates(25, 15)).toEqual(['ORD-1', 'ORD-2']);
    const [doc, vars] = hasura.executeQuery.mock.calls[0];
    expect(doc).toContain('order_by: { updated_at: asc }');
    expect(doc).toContain('payment_status: { _eq: "paid" }');
    expect(doc).toContain('stripe_tax_transaction_id: { _is_null: true }');
    expect(vars.limit).toBe(25);
    expect(Date.now() - Date.parse(vars.cutoff)).toBeGreaterThanOrEqual(15 * 60_000 - 1000);
  });

  it('void only moves estimated rows', async () => {
    await repo.markVoid('o-1');
    const doc: string = hasura.executeMutation.mock.calls[0][0];
    expect(doc.match(/_eq: "estimated"/g)).toHaveLength(2);
    expect(doc).toContain('tax_status: "void"');
  });

  it('reversal insert is conflict-safe on the Stripe refund id', async () => {
    await repo.insertReversal({
      snapshotId: 's-1',
      orderId: 'o-1',
      stripeRefundId: 're_1',
      stripeTaxReversalId: 'taxtr_1',
      reference: 'ORD-1_re_1',
      mode: 'partial',
      amountMinor: 4000,
      currency: 'CAD',
    });
    expect(hasura.executeMutation.mock.calls[0][0]).toContain(
      'on_conflict: { constraint: order_tax_reversals_stripe_refund_id_key, update_columns: [] }'
    );
  });

  it('sums reversed minor units and detects a replay', async () => {
    hasura.executeQuery.mockResolvedValue({
      order_tax_reversals: [
        { stripe_refund_id: 're_1', amount_minor: '4000' },
        { stripe_refund_id: 're_2', amount_minor: 1300 },
      ],
    });
    expect(await repo.getReversalState('s-1', 're_2')).toEqual({
      alreadyReversed: true,
      reversedMinor: 5300,
      refundIds: ['re_1', 're_2'],
    });
    expect((await repo.getReversalState('s-1', 're_9')).alreadyReversed).toBe(false);
  });

  it('no document ever writes the order money columns', async () => {
    hasura.executeQuery.mockResolvedValue({ orders: [], order_tax_reversals: [] });
    await repo.getContextByOrderNumber('X');
    await repo.markFinalized({
      orderId: 'o',
      calculationId: 'c',
      taxTransactionId: 't',
      capturedTotalIncludingTax: 1,
      taxBreakdown: null,
      taxJurisdiction: null,
    });
    await repo.markVoid('o');
    await repo.fillFinalizedGaps({ orderId: 'o', taxTransactionId: 't', capturedTotalIncludingTax: 1 });
    await repo.listReconcileCandidates(1, 1);
    await repo.getReversalState('s', 'r');
    for (const doc of allDocs()) {
      expect(doc).not.toMatch(/\b(total_amount|tax_amount|pre_tax_total|subtotal|service_fee|base_delivery_fee|per_km_delivery_fee|discount_amount)\b/);
    }
  });
});
