import {
  ORDER_TAX_STEP_DEADLINE_MS,
  OrderTaxLifecycleService,
} from './order-tax-lifecycle.service';

const builder = {
  fromMinorUnits: (m: number, c: string) =>
    ['XAF', 'XOF'].includes(c.toUpperCase()) ? m : m / 100,
  toMinorUnits: (a: number, c: string) =>
    ['XAF', 'XOF'].includes(c.toUpperCase()) ? Math.round(a) : Math.round(a * 100),
};

function calculation(id = 'taxcalc_1') {
  return {
    id,
    amount_total: 11300,
    tax_amount_exclusive: 1300,
    tax_breakdown: [{ amount: 1300 }],
    customer_details: { address: { country: 'CA', state: 'ON', postal_code: 'M5V', city: 'Toronto' } },
  };
}

describe('OrderTaxLifecycleService', () => {
  let repo: Record<string, jest.Mock>;
  let stripe: Record<string, jest.Mock>;
  let paymentsDb: Record<string, jest.Mock>;
  let service: OrderTaxLifecycleService;

  const ctxWith = (tax_status: string, snapshot: Record<string, unknown> | null = null) => ({
    order: { id: 'o-1', currency: 'CAD', tax_status },
    snapshot,
  });
  const estimatedCtx = (snapshot: Record<string, unknown> | null = null) => ctxWith('estimated', snapshot);
  const snap = (over: Record<string, unknown> = {}) => ({
    id: 's-1',
    status: 'estimated',
    currency: 'CAD',
    stripe_tax_calculation_id: 'taxcalc_1',
    stripe_tax_transaction_id: null,
    total_including_tax: 113,
    estimated_tax_amount: 13,
    captured_total_including_tax: null,
    ...over,
  });
  const finalizedSnap = (over: Record<string, unknown> = {}) =>
    snap({ status: 'finalized', stripe_tax_transaction_id: 'tax_txn_1', captured_total_including_tax: 113, ...over });

  beforeEach(() => {
    repo = {
      getContextByOrderNumber: jest.fn(),
      upsertEstimate: jest.fn().mockResolvedValue(undefined),
      markFinalized: jest.fn().mockResolvedValue({ snapshotsUpdated: 1, ordersUpdated: 1 }),
      fillFinalizedGaps: jest.fn().mockResolvedValue({ filled: 2 }),
      markVoid: jest.fn().mockResolvedValue(undefined),
      getReversalState: jest
        .fn()
        .mockResolvedValue({ alreadyReversed: false, reversedMinor: 0, refundIds: [] }),
      insertReversal: jest.fn().mockResolvedValue(undefined),
      listReconcileCandidates: jest.fn().mockResolvedValue([]),
    };
    stripe = {
      retrieveTaxCalculation: jest.fn().mockResolvedValue(calculation()),
      retrievePaymentIntent: jest.fn(),
      createTaxTransactionFromCalculation: jest.fn().mockResolvedValue({ id: 'tax_txn_1' }),
      createTaxReversal: jest.fn().mockResolvedValue({ id: 'taxtr_1' }),
    };
    paymentsDb = {
      getTransactionByEntityId: jest.fn(),
      listRefundsForOrder: jest.fn().mockResolvedValue([]),
    };
    service = new OrderTaxLifecycleService(
      repo as never,
      stripe as never,
      builder as never,
      paymentsDb as never
    );
  });

  describe('recordEstimate', () => {
    it('upserts the mapped calculation', async () => {
      await service.recordEstimate({ orderId: 'o-1', currency: 'CAD', calculation: calculation() as never });
      expect(repo.upsertEstimate).toHaveBeenCalledWith(
        'o-1',
        expect.objectContaining({
          stripe_tax_calculation_id: 'taxcalc_1',
          estimated_tax_amount: 13,
          total_including_tax: 113,
          currency: 'CAD',
        })
      );
    });

    it('skips a calculation without an id and swallows repo errors', async () => {
      await service.recordEstimate({ orderId: 'o-1', currency: 'CAD', calculation: { ...calculation(), id: '' } as never });
      expect(repo.upsertEstimate).not.toHaveBeenCalled();
      repo.upsertEstimate.mockRejectedValue(new Error('hasura'));
      await expect(
        service.recordEstimate({ orderId: 'o-1', currency: 'CAD', calculation: calculation() as never })
      ).resolves.toBeUndefined();
    });
  });

  describe('finalizeAfterCapture', () => {
    const pi = {
      id: 'pi_1',
      status: 'succeeded',
      amount_received: 11300,
      metadata: { stripe_tax_calculation_id: 'taxcalc_1' },
    };
    const finalize = () => service.finalizeAfterCapture({ orderNumber: 'ORD-1', paymentIntent: pi });

    it('creates the tax transaction and finalizes snapshot + order in one write, with a normalized breakdown', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(estimatedCtx(snap()));
      await expect(finalize()).resolves.toBe('finalized');

      expect(stripe.createTaxTransactionFromCalculation).toHaveBeenCalledWith('taxcalc_1', 'ORD-1', 'tax_txn_ORD-1');
      expect(repo.markFinalized).toHaveBeenCalledWith({
        orderId: 'o-1',
        calculationId: 'taxcalc_1',
        taxTransactionId: 'tax_txn_1',
        capturedTotalIncludingTax: 113,
        taxBreakdown: expect.objectContaining({ version: 1, source: 'tax_calculation' }),
        taxJurisdiction: { country: 'CA', state: 'ON', postal_code: 'M5V', city: 'Toronto' },
      });
      // Existing snapshot with the same calculation is not rewritten.
      expect(repo.upsertEstimate).not.toHaveBeenCalled();
    });

    it('is idempotent: a finalized order with a complete snapshot is a no-op', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(ctxWith('finalized', finalizedSnap()));
      await expect(finalize()).resolves.toBe('already_finalized');
      expect(stripe.createTaxTransactionFromCalculation).not.toHaveBeenCalled();
      expect(stripe.retrieveTaxCalculation).not.toHaveBeenCalled();
      expect(repo.markFinalized).not.toHaveBeenCalled();
      expect(repo.fillFinalizedGaps).not.toHaveBeenCalled();
    });

    it('an order with tax_status none is never touched (kills the tax_status guard mutant)', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(ctxWith('none', snap()));
      await expect(finalize()).resolves.toBe('skipped');
      expect(repo.markFinalized).not.toHaveBeenCalled();
      expect(repo.upsertEstimate).not.toHaveBeenCalled();
      expect(stripe.createTaxTransactionFromCalculation).not.toHaveBeenCalled();
    });

    it('a capture outranks an earlier void: void -> estimated -> finalized', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(
        ctxWith('void', snap({ status: 'void', stripe_tax_calculation_id: 'taxcalc_OLD' }))
      );
      await expect(finalize()).resolves.toBe('finalized');
      // The void snapshot is re-opened with the calculation that was really charged...
      expect(repo.upsertEstimate).toHaveBeenCalledWith('o-1', expect.objectContaining({ stripe_tax_calculation_id: 'taxcalc_1' }));
      // ...then finalized.
      expect(repo.markFinalized).toHaveBeenCalledWith(expect.objectContaining({ calculationId: 'taxcalc_1' }));
      expect(repo.upsertEstimate.mock.invocationCallOrder[0]).toBeLessThan(repo.markFinalized.mock.invocationCallOrder[0]);
    });

    it('a void snapshot with the same calculation finalizes without a rewrite', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(ctxWith('void', snap({ status: 'void' })));
      await expect(finalize()).resolves.toBe('finalized');
      expect(repo.upsertEstimate).not.toHaveBeenCalled();
    });

    it('is a no-op for an unknown order', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(null);
      await expect(
        service.finalizeAfterCapture({ orderNumber: 'ORD-X', paymentIntent: pi })
      ).resolves.toBe('skipped');
      expect(repo.markFinalized).not.toHaveBeenCalled();
    });

    it('does not finalize an uncaptured PaymentIntent or a call without one', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(estimatedCtx(snap()));
      await expect(
        service.finalizeAfterCapture({ orderNumber: 'ORD-1', paymentIntent: { ...pi, status: 'requires_capture' } })
      ).resolves.toBe('skipped');
      await expect(service.finalizeAfterCapture({ orderNumber: 'ORD-1' })).resolves.toBe('skipped');
      expect(repo.markFinalized).not.toHaveBeenCalled();
    });

    it('creates the snapshot from PI metadata when checkout never recorded one (in-flight orders)', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(estimatedCtx(null));
      await finalize();
      expect(stripe.retrieveTaxCalculation).toHaveBeenCalledWith('taxcalc_1');
      expect(repo.upsertEstimate).toHaveBeenCalledWith('o-1', expect.objectContaining({ stripe_tax_calculation_id: 'taxcalc_1' }));
      expect(repo.markFinalized).toHaveBeenCalledWith(expect.objectContaining({ taxTransactionId: 'tax_txn_1' }));
    });

    it('a failed snapshot write is NOT swallowed: the order stays estimated (deferred), never finalized without a snapshot', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(estimatedCtx(null));
      repo.upsertEstimate.mockRejectedValue(new Error('hasura write failed'));
      await expect(finalize()).resolves.toBe('deferred');
      expect(repo.markFinalized).not.toHaveBeenCalled();
      expect(stripe.createTaxTransactionFromCalculation).not.toHaveBeenCalled();
    });

    it('refreshes the snapshot when a payment retry used a newer calculation', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(estimatedCtx(snap({ stripe_tax_calculation_id: 'taxcalc_OLD' })));
      await finalize();
      expect(repo.upsertEstimate).toHaveBeenCalledTimes(1);
      expect(stripe.createTaxTransactionFromCalculation).toHaveBeenCalledWith('taxcalc_1', 'ORD-1', 'tax_txn_ORD-1');
    });

    it('falls back to the snapshot calculation id when the PI has no metadata, and fetches the PI when metadata is absent', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(estimatedCtx(snap()));
      stripe.retrievePaymentIntent.mockResolvedValue({ id: 'pi_1', status: 'succeeded', amount_received: 11300, metadata: {} });
      await service.finalizeAfterCapture({ orderNumber: 'ORD-1', paymentIntent: { id: 'pi_1' } });
      expect(stripe.retrievePaymentIntent).toHaveBeenCalledWith('pi_1');
      expect(repo.markFinalized).toHaveBeenCalledWith(expect.objectContaining({ calculationId: 'taxcalc_1' }));
    });

    it('does nothing when no calculation id can be found (hosted Checkout / legacy)', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(estimatedCtx(null));
      await expect(
        service.finalizeAfterCapture({ orderNumber: 'ORD-1', paymentIntent: { id: 'pi_1', status: 'succeeded', metadata: {} } })
      ).resolves.toBe('skipped');
      expect(repo.markFinalized).not.toHaveBeenCalled();
    });

    it('reuses an existing tax transaction id instead of creating another', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(estimatedCtx(snap({ stripe_tax_transaction_id: 'tax_txn_9' })));
      await finalize();
      expect(stripe.createTaxTransactionFromCalculation).not.toHaveBeenCalled();
      expect(repo.markFinalized).toHaveBeenCalledWith(expect.objectContaining({ taxTransactionId: 'tax_txn_9' }));
    });

    it('never finalizes without a Stripe tax transaction: stays estimated and is reported deferred', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(estimatedCtx(snap()));
      stripe.createTaxTransactionFromCalculation.mockRejectedValue(new Error('stripe 500'));
      await expect(finalize()).resolves.toBe('deferred');
      expect(repo.markFinalized).not.toHaveBeenCalled();
    });

    it('HEAL: a finalized snapshot with a NULL transaction id gets it filled, nothing else changes', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(
        ctxWith('finalized', finalizedSnap({ stripe_tax_transaction_id: null }))
      );
      await expect(finalize()).resolves.toBe('healed');
      expect(stripe.createTaxTransactionFromCalculation).toHaveBeenCalledWith('taxcalc_1', 'ORD-1', 'tax_txn_ORD-1');
      expect(repo.fillFinalizedGaps).toHaveBeenCalledWith({
        orderId: 'o-1',
        taxTransactionId: 'tax_txn_1',
        capturedTotalIncludingTax: 113,
      });
      expect(repo.markFinalized).not.toHaveBeenCalled();
      expect(repo.upsertEstimate).not.toHaveBeenCalled();
    });

    it('HEAL: a finalized snapshot without the captured total gets it filled from the PaymentIntent', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(
        ctxWith('finalized', finalizedSnap({ captured_total_including_tax: null }))
      );
      await expect(finalize()).resolves.toBe('healed');
      expect(repo.fillFinalizedGaps).toHaveBeenCalledWith(
        expect.objectContaining({ taxTransactionId: 'tax_txn_1', capturedTotalIncludingTax: 113 })
      );
      expect(stripe.createTaxTransactionFromCalculation).not.toHaveBeenCalled();
    });

    it('a lost finalize race is reported as already finalized, and fills any gap', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(estimatedCtx(snap()));
      repo.markFinalized.mockResolvedValue({ snapshotsUpdated: 0, ordersUpdated: 0 });
      await expect(finalize()).resolves.toBe('already_finalized');
      expect(repo.fillFinalizedGaps).toHaveBeenCalled();
    });

    it('never throws', async () => {
      repo.getContextByOrderNumber.mockRejectedValue(new Error('hasura down'));
      await expect(finalize()).resolves.toBe('deferred');
    });

    it('is bounded by a deadline: a hung Stripe call defers instead of hanging the capture', async () => {
      jest.useFakeTimers();
      try {
        repo.getContextByOrderNumber.mockResolvedValue(estimatedCtx(snap()));
        stripe.createTaxTransactionFromCalculation.mockReturnValue(new Promise(() => undefined));
        const p = finalize();
        await jest.advanceTimersByTimeAsync(ORDER_TAX_STEP_DEADLINE_MS + 10);
        await expect(p).resolves.toBe('deferred');
        expect(repo.markFinalized).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('resolveRefundTaxMode', () => {
    const pi = { id: 'pi_1', status: 'succeeded', amount_received: 11300, metadata: { stripe_tax_calculation_id: 'taxcalc_1' } };

    it('is tax-inclusive for a finalized snapshot', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(ctxWith('finalized', finalizedSnap()));
      await expect(service.resolveRefundTaxMode('ORD-1', pi)).resolves.toBe(true);
      expect(stripe.createTaxTransactionFromCalculation).not.toHaveBeenCalled();
    });

    it.each([['none'], ['finalized']])('is legacy (pre-tax) with tax_status %s and no snapshot', async (st) => {
      repo.getContextByOrderNumber.mockResolvedValue(ctxWith(st, null));
      stripe.retrieveTaxCalculation.mockRejectedValue(new Error('no calc'));
      await expect(service.resolveRefundTaxMode('ORD-1', { ...pi, metadata: {} })).resolves.toBe(false);
    });

    it('heals a captured-but-unfinalized order first, then refunds tax-inclusively', async () => {
      repo.getContextByOrderNumber
        .mockResolvedValueOnce(estimatedCtx(snap()))
        .mockResolvedValueOnce(estimatedCtx(snap()))
        .mockResolvedValueOnce(ctxWith('finalized', finalizedSnap()));
      await expect(service.resolveRefundTaxMode('ORD-1', pi)).resolves.toBe(true);
      expect(repo.markFinalized).toHaveBeenCalledTimes(1);
    });

    it('stays tax-inclusive when the heal cannot finish so the customer still gets the tax', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(estimatedCtx(snap()));
      stripe.createTaxTransactionFromCalculation.mockRejectedValue(new Error('stripe 500'));
      await expect(service.resolveRefundTaxMode('ORD-1', pi)).resolves.toBe(true);
    });

    it('stays tax-inclusive for a void snapshot that capture reopened but could not finalize', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(ctxWith('void', snap({ status: 'void' })));
      stripe.createTaxTransactionFromCalculation.mockRejectedValue(new Error('stripe 500'));
      await expect(service.resolveRefundTaxMode('ORD-1', pi)).resolves.toBe(true);
    });

    it('THROWS when the tax state cannot be read, so the refund fails closed', async () => {
      repo.getContextByOrderNumber.mockRejectedValue(new Error('hasura down'));
      await expect(service.resolveRefundTaxMode('ORD-1', pi)).rejects.toThrow('hasura down');
    });
  });

  describe('voidForOrder', () => {
    it('voids an estimated order', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(estimatedCtx(snap()));
      await service.voidForOrder('ORD-1');
      expect(repo.markVoid).toHaveBeenCalledWith('o-1');
    });

    it('never voids finalized, void or none orders', async () => {
      for (const tax_status of ['finalized', 'void', 'none']) {
        repo.getContextByOrderNumber.mockResolvedValue(ctxWith(tax_status, null));
        await service.voidForOrder('ORD-1');
      }
      expect(repo.markVoid).not.toHaveBeenCalled();
    });

    it('never throws', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(estimatedCtx());
      repo.markVoid.mockRejectedValue(new Error('x'));
      await expect(service.voidForOrder('ORD-1')).resolves.toBeUndefined();
    });
  });

  describe('reverseForRefund', () => {
    const finalizedCtx = () => ctxWith('finalized', finalizedSnap());

    beforeEach(() => repo.getContextByOrderNumber.mockResolvedValue(finalizedCtx()));

    it('creates a full reversal when the refund covers the whole transaction', async () => {
      await expect(
        service.reverseForRefund({ orderNumber: 'ORD-1', stripeRefundId: 're_1', refundAmountMinor: 11300 })
      ).resolves.toBe('reversed');
      expect(stripe.createTaxReversal).toHaveBeenCalledWith({
        originalTransactionId: 'tax_txn_1',
        mode: 'full',
        flatAmountMinor: 11300,
        reference: 'ORD-1_re_1',
        idempotencyKey: 'tax_reversal_re_1_11300',
        metadata: { orderNumber: 'ORD-1', stripeRefundId: 're_1' },
      });
      expect(repo.insertReversal).toHaveBeenCalledWith({
        snapshotId: 's-1',
        orderId: 'o-1',
        stripeRefundId: 're_1',
        stripeTaxReversalId: 'taxtr_1',
        reference: 'ORD-1_re_1',
        mode: 'full',
        amountMinor: 11300,
        currency: 'CAD',
      });
    });

    it('creates a partial reversal for a partial refund', async () => {
      await service.reverseForRefund({ orderNumber: 'ORD-1', stripeRefundId: 're_2', refundAmountMinor: 4000 });
      expect(stripe.createTaxReversal).toHaveBeenCalledWith(expect.objectContaining({ mode: 'partial', flatAmountMinor: 4000 }));
    });

    it('caps against earlier reversals', async () => {
      repo.getReversalState.mockResolvedValue({ alreadyReversed: false, reversedMinor: 10000, refundIds: [] });
      await service.reverseForRefund({ orderNumber: 'ORD-1', stripeRefundId: 're_3', refundAmountMinor: 4000 });
      expect(stripe.createTaxReversal).toHaveBeenCalledWith(expect.objectContaining({ mode: 'partial', flatAmountMinor: 1300 }));
    });

    it('is idempotent per refund id (create-time path then refund.updated webhook)', async () => {
      repo.getReversalState.mockResolvedValue({ alreadyReversed: true, reversedMinor: 4000, refundIds: ['re_2'] });
      await expect(
        service.reverseForRefund({ orderNumber: 'ORD-1', stripeRefundId: 're_2', refundAmountMinor: 4000 })
      ).resolves.toBe('already_reversed');
      expect(stripe.createTaxReversal).not.toHaveBeenCalled();
      expect(repo.insertReversal).not.toHaveBeenCalled();
    });

    it('does nothing once the transaction is fully reversed', async () => {
      repo.getReversalState.mockResolvedValue({ alreadyReversed: false, reversedMinor: 11300, refundIds: [] });
      await service.reverseForRefund({ orderNumber: 'ORD-1', stripeRefundId: 're_4', refundAmountMinor: 100 });
      expect(stripe.createTaxReversal).not.toHaveBeenCalled();
    });

    it.each([
      ['estimated snapshot', snap({ status: 'estimated', stripe_tax_transaction_id: null })],
      ['void snapshot', snap({ status: 'void', stripe_tax_transaction_id: 'tax_txn_1' })],
      ['finalized without a tax transaction id', snap({ status: 'finalized', stripe_tax_transaction_id: null })],
    ])('skips for %s', async (_n, snapshot) => {
      repo.getContextByOrderNumber.mockResolvedValue(ctxWith('x', snapshot));
      await expect(
        service.reverseForRefund({ orderNumber: 'ORD-1', stripeRefundId: 're_5', refundAmountMinor: 100 })
      ).resolves.toBe('skipped');
      expect(stripe.createTaxReversal).not.toHaveBeenCalled();
    });

    it('skips orders without a snapshot (e.g. non-tax countries / pre-feature orders)', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(ctxWith('none', null));
      await service.reverseForRefund({ orderNumber: 'ORD-1', stripeRefundId: 're_6', refundAmountMinor: 100 });
      expect(stripe.createTaxReversal).not.toHaveBeenCalled();
    });

    it('logs and reports a Stripe failure, without writing a ledger row', async () => {
      stripe.createTaxReversal.mockRejectedValue(new Error('reference already exists'));
      await expect(
        service.reverseForRefund({ orderNumber: 'ORD-1', stripeRefundId: 're_7', refundAmountMinor: 100 })
      ).resolves.toBe('failed');
      expect(repo.insertReversal).not.toHaveBeenCalled();
    });

    it('reports a ledger-write failure (the reversal exists in Stripe) as failed, never throws', async () => {
      repo.insertReversal.mockRejectedValue(new Error('hasura'));
      await expect(
        service.reverseForRefund({ orderNumber: 'ORD-1', stripeRefundId: 're_8', refundAmountMinor: 100 })
      ).resolves.toBe('failed');
    });

    it('the idempotency key carries the amount, so a corrected retry is a new Stripe request', async () => {
      await service.reverseForRefund({ orderNumber: 'ORD-1', stripeRefundId: 're_9', refundAmountMinor: 4520 });
      await service.reverseForRefund({ orderNumber: 'ORD-1', stripeRefundId: 're_9', refundAmountMinor: 4000 });
      const keys = stripe.createTaxReversal.mock.calls.map((c) => c[0].idempotencyKey);
      expect(keys).toEqual(['tax_reversal_re_9_4520', 'tax_reversal_re_9_4000']);
    });
  });

  describe('reconcile', () => {
    const successTx = { status: 'success', stripe_payment_intent_id: 'pi_1' };
    const capturedPi = {
      id: 'pi_1',
      status: 'succeeded',
      amount_received: 11300,
      metadata: { stripe_tax_calculation_id: 'taxcalc_1' },
    };

    it('finalizes a captured order that was left estimated', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(estimatedCtx(snap()));
      paymentsDb.getTransactionByEntityId.mockResolvedValue(successTx);
      stripe.retrievePaymentIntent.mockResolvedValue(capturedPi);
      const item = await service.reconcileOrder('ORD-1', { dryRun: false });
      expect(item).toMatchObject({ orderNumber: 'ORD-1', finalize: 'finalized' });
      expect(repo.markFinalized).toHaveBeenCalledTimes(1);
    });

    it('dry-run only reports: no Stripe call, no write', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(estimatedCtx(snap()));
      paymentsDb.getTransactionByEntityId.mockResolvedValue(successTx);
      const item = await service.reconcileOrder('ORD-1', { dryRun: true });
      expect(item.finalize).toBe('would_finalize');
      expect(stripe.retrievePaymentIntent).not.toHaveBeenCalled();
      expect(stripe.createTaxTransactionFromCalculation).not.toHaveBeenCalled();
      expect(repo.markFinalized).not.toHaveBeenCalled();
      expect(repo.fillFinalizedGaps).not.toHaveBeenCalled();
    });

    it('leaves an authorized (not captured) order alone', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(estimatedCtx(snap()));
      paymentsDb.getTransactionByEntityId.mockResolvedValue({ status: 'authorized', stripe_payment_intent_id: 'pi_1' });
      const item = await service.reconcileOrder('ORD-1', { dryRun: false });
      expect(item.finalize).toBe('not_needed');
      expect(stripe.retrievePaymentIntent).not.toHaveBeenCalled();
    });

    it('heals a finalized snapshot that has no transaction id', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(ctxWith('finalized', finalizedSnap({ stripe_tax_transaction_id: null })));
      paymentsDb.getTransactionByEntityId.mockResolvedValue(successTx);
      stripe.retrievePaymentIntent.mockResolvedValue(capturedPi);
      const item = await service.reconcileOrder('ORD-1', { dryRun: false });
      expect(item.finalize).toBe('healed');
    });

    it('reverses the tax of a succeeded refund that has no reversal row (catch-up), using ledger + tax', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(ctxWith('finalized', finalizedSnap()));
      paymentsDb.getTransactionByEntityId.mockResolvedValue(successTx);
      paymentsDb.listRefundsForOrder.mockResolvedValue([
        { stripe_refund_id: 're_1', status: 'succeeded', amount: 40, tax_refund_amount: 5.2 },
        { stripe_refund_id: 're_2', status: 'succeeded', amount: 10, tax_refund_amount: 0 },
        { stripe_refund_id: 're_3', status: 'pending', amount: 10, tax_refund_amount: 1.3 },
        { stripe_refund_id: null, status: 'succeeded', amount: 10, tax_refund_amount: 0 },
      ]);
      repo.getReversalState.mockResolvedValue({ alreadyReversed: false, reversedMinor: 1000, refundIds: ['re_2'] });
      const item = await service.reconcileOrder('ORD-1', { dryRun: false });
      expect(item.reversals).toBe(1);
      expect(stripe.createTaxReversal).toHaveBeenCalledTimes(1);
      expect(stripe.createTaxReversal).toHaveBeenCalledWith(
        expect.objectContaining({ flatAmountMinor: 4520, reference: 'ORD-1_re_1' })
      );
    });

    it('a batch scans candidates, summarizes and survives one failing order', async () => {
      repo.listReconcileCandidates.mockResolvedValue(['ORD-1', 'ORD-2']);
      repo.getContextByOrderNumber
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValue(ctxWith('none'));
      const res = await service.reconcileBatch({ dryRun: true, limit: 10 });
      expect(res.scanned).toBe(2);
      expect(res.items[0].detail).toBe('boom');
      expect(repo.listReconcileCandidates).toHaveBeenCalledWith(10, 15);
    });
  });
});
