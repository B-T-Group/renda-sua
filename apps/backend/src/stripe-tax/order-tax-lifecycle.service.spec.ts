import { OrderTaxLifecycleService } from './order-tax-lifecycle.service';

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
  let service: OrderTaxLifecycleService;

  const estimatedCtx = (snapshot: Record<string, unknown> | null = null) => ({
    order: { id: 'o-1', currency: 'CAD', tax_status: 'estimated' },
    snapshot,
  });
  const snap = (over: Record<string, unknown> = {}) => ({
    id: 's-1',
    status: 'estimated',
    currency: 'CAD',
    stripe_tax_calculation_id: 'taxcalc_1',
    stripe_tax_transaction_id: null,
    total_including_tax: 113,
    ...over,
  });

  beforeEach(() => {
    repo = {
      getContextByOrderNumber: jest.fn(),
      upsertEstimate: jest.fn().mockResolvedValue(undefined),
      markFinalized: jest.fn().mockResolvedValue({ snapshotsUpdated: 1 }),
      markVoid: jest.fn().mockResolvedValue(undefined),
      getReversalState: jest.fn().mockResolvedValue({ alreadyReversed: false, reversedMinor: 0 }),
      insertReversal: jest.fn().mockResolvedValue(undefined),
    };
    stripe = {
      retrieveTaxCalculation: jest.fn().mockResolvedValue(calculation()),
      retrievePaymentIntent: jest.fn(),
      createTaxTransactionFromCalculation: jest.fn().mockResolvedValue({ id: 'tax_txn_1' }),
      createTaxReversal: jest.fn().mockResolvedValue({ id: 'taxtr_1' }),
    };
    service = new OrderTaxLifecycleService(repo as never, stripe as never, builder as never);
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
      amount_received: 11300,
      metadata: { stripe_tax_calculation_id: 'taxcalc_1' },
    };

    it('creates the tax transaction and finalizes snapshot fields only', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(estimatedCtx(snap()));
      await service.finalizeAfterCapture({ orderNumber: 'ORD-1', paymentIntent: pi });

      expect(stripe.createTaxTransactionFromCalculation).toHaveBeenCalledWith(
        'taxcalc_1',
        'ORD-1',
        'tax_txn_ORD-1'
      );
      expect(repo.markFinalized).toHaveBeenCalledWith({
        orderId: 'o-1',
        calculationId: 'taxcalc_1',
        taxTransactionId: 'tax_txn_1',
        capturedTotalIncludingTax: 113,
        taxBreakdown: [{ amount: 1300 }],
        taxJurisdiction: { country: 'CA', state: 'ON', postal_code: 'M5V', city: 'Toronto' },
      });
      // Existing snapshot with the same calculation is not rewritten.
      expect(repo.upsertEstimate).not.toHaveBeenCalled();
    });

    it('is idempotent: finalized / void / none orders are no-ops', async () => {
      for (const tax_status of ['finalized', 'void', 'none']) {
        repo.getContextByOrderNumber.mockResolvedValue({
          order: { id: 'o-1', currency: 'CAD', tax_status },
          snapshot: snap({ status: 'finalized', stripe_tax_transaction_id: 'tax_txn_1' }),
        });
        await service.finalizeAfterCapture({ orderNumber: 'ORD-1', paymentIntent: pi });
      }
      expect(stripe.createTaxTransactionFromCalculation).not.toHaveBeenCalled();
      expect(repo.markFinalized).not.toHaveBeenCalled();
    });

    it('is a no-op for an unknown order', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(null);
      await service.finalizeAfterCapture({ orderNumber: 'ORD-X', paymentIntent: pi });
      expect(repo.markFinalized).not.toHaveBeenCalled();
    });

    it('creates the snapshot from PI metadata when checkout never recorded one (in-flight orders)', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(estimatedCtx(null));
      await service.finalizeAfterCapture({ orderNumber: 'ORD-1', paymentIntent: pi });
      expect(stripe.retrieveTaxCalculation).toHaveBeenCalledWith('taxcalc_1');
      expect(repo.upsertEstimate).toHaveBeenCalledWith('o-1', expect.objectContaining({ stripe_tax_calculation_id: 'taxcalc_1' }));
      expect(repo.markFinalized).toHaveBeenCalledWith(expect.objectContaining({ taxTransactionId: 'tax_txn_1' }));
    });

    it('refreshes the snapshot when a payment retry used a newer calculation', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(estimatedCtx(snap({ stripe_tax_calculation_id: 'taxcalc_OLD' })));
      await service.finalizeAfterCapture({ orderNumber: 'ORD-1', paymentIntent: pi });
      expect(repo.upsertEstimate).toHaveBeenCalledTimes(1);
      expect(stripe.createTaxTransactionFromCalculation).toHaveBeenCalledWith('taxcalc_1', 'ORD-1', 'tax_txn_ORD-1');
    });

    it('falls back to the snapshot calculation id when the PI has no metadata, and fetches the PI when metadata is absent', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(estimatedCtx(snap()));
      stripe.retrievePaymentIntent.mockResolvedValue({ id: 'pi_1', amount_received: 11300, metadata: {} });
      await service.finalizeAfterCapture({ orderNumber: 'ORD-1', paymentIntent: { id: 'pi_1' } });
      expect(stripe.retrievePaymentIntent).toHaveBeenCalledWith('pi_1');
      expect(repo.markFinalized).toHaveBeenCalledWith(expect.objectContaining({ calculationId: 'taxcalc_1' }));
    });

    it('does nothing when no calculation id can be found', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(estimatedCtx(null));
      await service.finalizeAfterCapture({ orderNumber: 'ORD-1', paymentIntent: { id: 'pi_1', metadata: {} } });
      expect(repo.markFinalized).not.toHaveBeenCalled();
    });

    it('reuses an existing tax transaction id instead of creating another', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(estimatedCtx(snap({ stripe_tax_transaction_id: 'tax_txn_9' })));
      await service.finalizeAfterCapture({ orderNumber: 'ORD-1', paymentIntent: pi });
      expect(stripe.createTaxTransactionFromCalculation).not.toHaveBeenCalled();
      expect(repo.markFinalized).toHaveBeenCalledWith(expect.objectContaining({ taxTransactionId: 'tax_txn_9' }));
    });

    it('stays estimated (retryable by the webhook) when the Stripe tax transaction fails', async () => {
      repo.getContextByOrderNumber.mockResolvedValue(estimatedCtx(snap()));
      stripe.createTaxTransactionFromCalculation.mockRejectedValue(new Error('stripe 500'));
      await expect(service.finalizeAfterCapture({ orderNumber: 'ORD-1', paymentIntent: pi })).resolves.toBeUndefined();
      expect(repo.markFinalized).not.toHaveBeenCalled();
    });

    it('never throws', async () => {
      repo.getContextByOrderNumber.mockRejectedValue(new Error('hasura down'));
      await expect(service.finalizeAfterCapture({ orderNumber: 'ORD-1', paymentIntent: pi })).resolves.toBeUndefined();
    });
  });

  describe('syncLegacyFinalized', () => {
    it('mirrors the legacy auto-capture finalizer into the snapshot', async () => {
      repo.getContextByOrderNumber.mockResolvedValue({
        order: { id: 'o-1', currency: 'CAD', tax_status: 'finalized' },
        snapshot: null,
      });
      await service.syncLegacyFinalized({
        orderNumber: 'ORD-1',
        calculation: calculation() as never,
        taxTransactionId: 'tax_txn_1',
      });
      expect(repo.upsertEstimate).toHaveBeenCalled();
      expect(repo.markFinalized).toHaveBeenCalledWith(
        expect.objectContaining({ taxTransactionId: 'tax_txn_1', capturedTotalIncludingTax: null })
      );
    });

    it('leaves finalized and void snapshots alone', async () => {
      for (const status of ['finalized', 'void']) {
        repo.getContextByOrderNumber.mockResolvedValue({
          order: { id: 'o-1', currency: 'CAD', tax_status: 'finalized' },
          snapshot: snap({ status }),
        });
        await service.syncLegacyFinalized({ orderNumber: 'ORD-1', calculation: calculation() as never });
      }
      expect(repo.markFinalized).not.toHaveBeenCalled();
    });

    it('never throws', async () => {
      repo.getContextByOrderNumber.mockRejectedValue(new Error('x'));
      await expect(
        service.syncLegacyFinalized({ orderNumber: 'ORD-1', calculation: calculation() as never })
      ).resolves.toBeUndefined();
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
        repo.getContextByOrderNumber.mockResolvedValue({
          order: { id: 'o-1', currency: 'CAD', tax_status },
          snapshot: null,
        });
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
    const finalizedCtx = () => ({
      order: { id: 'o-1', currency: 'CAD', tax_status: 'finalized' },
      snapshot: snap({ status: 'finalized', stripe_tax_transaction_id: 'tax_txn_1' }),
    });

    beforeEach(() => repo.getContextByOrderNumber.mockResolvedValue(finalizedCtx()));

    it('creates a full reversal when the refund covers the whole transaction', async () => {
      await service.reverseForRefund({ orderNumber: 'ORD-1', stripeRefundId: 're_1', refundAmountMinor: 11300 });
      expect(stripe.createTaxReversal).toHaveBeenCalledWith({
        originalTransactionId: 'tax_txn_1',
        mode: 'full',
        flatAmountMinor: 11300,
        reference: 'ORD-1_re_1',
        idempotencyKey: 'tax_reversal_re_1',
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
      repo.getReversalState.mockResolvedValue({ alreadyReversed: false, reversedMinor: 10000 });
      await service.reverseForRefund({ orderNumber: 'ORD-1', stripeRefundId: 're_3', refundAmountMinor: 4000 });
      expect(stripe.createTaxReversal).toHaveBeenCalledWith(expect.objectContaining({ mode: 'partial', flatAmountMinor: 1300 }));
    });

    it('is idempotent per refund id (create-time path then refund.updated webhook)', async () => {
      repo.getReversalState.mockResolvedValue({ alreadyReversed: true, reversedMinor: 4000 });
      await service.reverseForRefund({ orderNumber: 'ORD-1', stripeRefundId: 're_2', refundAmountMinor: 4000 });
      expect(stripe.createTaxReversal).not.toHaveBeenCalled();
      expect(repo.insertReversal).not.toHaveBeenCalled();
    });

    it('does nothing once the transaction is fully reversed', async () => {
      repo.getReversalState.mockResolvedValue({ alreadyReversed: false, reversedMinor: 11300 });
      await service.reverseForRefund({ orderNumber: 'ORD-1', stripeRefundId: 're_4', refundAmountMinor: 100 });
      expect(stripe.createTaxReversal).not.toHaveBeenCalled();
    });

    it.each([
      ['estimated snapshot', snap({ status: 'estimated', stripe_tax_transaction_id: null })],
      ['void snapshot', snap({ status: 'void', stripe_tax_transaction_id: 'tax_txn_1' })],
      ['finalized without a tax transaction id', snap({ status: 'finalized', stripe_tax_transaction_id: null })],
    ])('skips for %s', async (_n, snapshot) => {
      repo.getContextByOrderNumber.mockResolvedValue({ order: { id: 'o-1', currency: 'CAD', tax_status: 'x' }, snapshot });
      await service.reverseForRefund({ orderNumber: 'ORD-1', stripeRefundId: 're_5', refundAmountMinor: 100 });
      expect(stripe.createTaxReversal).not.toHaveBeenCalled();
    });

    it('skips orders without a snapshot (e.g. non-tax countries / pre-feature orders)', async () => {
      repo.getContextByOrderNumber.mockResolvedValue({ order: { id: 'o-1', currency: 'CAD', tax_status: 'none' }, snapshot: null });
      await service.reverseForRefund({ orderNumber: 'ORD-1', stripeRefundId: 're_6', refundAmountMinor: 100 });
      expect(stripe.createTaxReversal).not.toHaveBeenCalled();
    });

    it('logs and swallows a Stripe failure, without writing a ledger row', async () => {
      stripe.createTaxReversal.mockRejectedValue(new Error('reference already exists'));
      await expect(
        service.reverseForRefund({ orderNumber: 'ORD-1', stripeRefundId: 're_7', refundAmountMinor: 100 })
      ).resolves.toBeUndefined();
      expect(repo.insertReversal).not.toHaveBeenCalled();
    });

    it('swallows a ledger-write failure', async () => {
      repo.insertReversal.mockRejectedValue(new Error('hasura'));
      await expect(
        service.reverseForRefund({ orderNumber: 'ORD-1', stripeRefundId: 're_8', refundAmountMinor: 100 })
      ).resolves.toBeUndefined();
    });
  });
});
