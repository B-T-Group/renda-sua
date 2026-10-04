import { Test, TestingModule } from '@nestjs/testing';
import { CancellationPolicyService } from './cancellation-policy.service';

jest.mock('../hasura/hasura-system.service', () => ({
  HasuraSystemService: class HasuraSystemService {},
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { HasuraSystemService } = require('../hasura/hasura-system.service');

describe('CancellationPolicyService', () => {
  let service: CancellationPolicyService;
  let hasuraService: jest.Mocked<Pick<HasuraSystemService, 'executeQuery'>>;

  const baseOrder = {
    id: 'order-1',
    current_status: 'pending',
    assigned_agent_id: null,
    total_amount: 5000,
    currency: 'XAF',
    payment_source: 'credit_card',
    payment_status: 'paid',
    payment_timing: 'pay_now',
    business_location: { country_code: 'GA' },
  };

  const clientReasons = [
    { id: 1, value: 'changed_mind', display: 'Changed my mind' },
    { id: 5, value: 'other', display: 'Other' },
  ];

  /** Route executeQuery: fee-percent rows vs. cancellation reasons. */
  const mockFeeRows = (
    rows: Array<{ country_code: string | null; number_value: number | null }>,
    reasons: unknown[] = clientReasons
  ) => {
    hasuraService.executeQuery.mockImplementation(async (query: string) =>
      String(query).includes('FeePercentRows')
        ? { application_configurations: rows }
        : { order_cancellation_reasons: reasons }
    );
  };

  beforeEach(async () => {
    hasuraService = {
      executeQuery: jest.fn().mockResolvedValue({
        order_cancellation_reasons: clientReasons,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CancellationPolicyService,
        { provide: HasuraSystemService, useValue: hasuraService },
      ],
    }).compile();

    service = module.get<CancellationPolicyService>(CancellationPolicyService);
  });

  describe('client policy — pending status, no fee', () => {
    it('returns canCancel=true with full refund', async () => {
      const policy = await service.getPolicy(baseOrder, 'client');

      expect(policy.canCancel).toBe(true);
      expect(policy.refundType).toBe('full');
      expect(policy.cancellationFee).toBe(0);
      expect(policy.refundAmount).toBe(5000);
      expect(policy.availableCancellationReasons).toEqual(clientReasons);
    });

    it('resolves stripe processing time for credit_card', async () => {
      const policy = await service.getPolicy(baseOrder, 'client');
      expect(policy.estimatedRefundProcessingTime).toBe('stripe_5_10_business_days');
    });
  });

  describe('client policy — confirmed status, 30% of item subtotal after discounts', () => {
    // items after discount 4000 + delivery 800 + tax 200 = 5000
    const orderWithParts = {
      ...baseOrder,
      current_status: 'confirmed',
      total_amount: 5000,
      base_delivery_fee: 500,
      per_km_delivery_fee: 300,
      delivery_fee_waived: false,
      tax_amount: 200,
    };

    it('charges 30% of items (excludes delivery fee and tax)', async () => {
      mockFeeRows([{ country_code: 'GA', number_value: 30 }]);

      const policy = await service.getPolicy(orderWithParts, 'client');

      expect(policy.canCancel).toBe(true);
      expect(policy.refundType).toBe('partial');
      expect(policy.cancellationFee).toBe(1200);
      expect(policy.cancellationFeePercent).toBe(30);
      expect(policy.refundAmount).toBe(3800);
    });

    it('does not subtract a waived delivery fee from the base', async () => {
      mockFeeRows([{ country_code: 'GA', number_value: 30 }]);
      const policy = await service.getPolicy(
        { ...orderWithParts, total_amount: 4200, delivery_fee_waived: true },
        'client'
      );
      expect(policy.cancellationFee).toBe(1200);
    });

    it('Cameroon (country name from the address) uses the CM row', async () => {
      mockFeeRows([{ country_code: 'CM', number_value: 30 }]);
      const policy = await service.getPolicy(
        { ...orderWithParts, business_location: { country_code: 'Cameroon' } },
        'client'
      );
      expect(policy.cancellationFee).toBe(1200);
      const [, vars] = hasuraService.executeQuery.mock.calls.find(([q]) =>
        String(q).includes('FeePercentRows')
      )!;
      expect(vars).toEqual({ key: 'cancellation_fee_percent', country: 'CM' });
    });

    it('Canada explicit 0 row => no fee, full refund', async () => {
      mockFeeRows([{ country_code: 'CA', number_value: 0 }]);
      const policy = await service.getPolicy(
        { ...orderWithParts, currency: 'CAD', business_location: { country_code: 'CA' } },
        'client'
      );
      expect(policy.cancellationFee).toBe(0);
      expect(policy.cancellationFeePercent).toBe(0);
      expect(policy.refundAmount).toBe(5000);
      expect(policy.refundType).toBe('full');
    });

    it('missing row => 30% default and a cancellation_fee_config_missing error log (not a silent 0)', async () => {
      mockFeeRows([]);
      const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();
      const policy = await service.getPolicy(orderWithParts, 'client');
      expect(policy.cancellationFee).toBe(1200);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('cancellation_fee_config_missing')
      );
    });

    it('a Hasura read error is not swallowed into a 0 fee', async () => {
      hasuraService.executeQuery.mockRejectedValue(new Error('hasura down'));
      await expect(service.getPolicy(orderWithParts, 'client')).rejects.toThrow(
        'hasura down'
      );
    });

    it('uses the percent fee, not a flat amount', async () => {
      mockFeeRows([{ country_code: 'GA', number_value: 30 }]);
      const policy = await service.getPolicy(orderWithParts, 'client');
      expect(policy.cancellationFee).toBe(1200);
    });

    it.each(['pay_at_delivery', 'pay_at_pickup'])(
      'no fee at all for %s orders (no config read)',
      async (timing) => {
        mockFeeRows([{ country_code: 'GA', number_value: 30 }]);
        const policy = await service.getPolicy(
          { ...orderWithParts, payment_timing: timing, payment_status: 'pending' },
          'client'
        );
        expect(policy.cancellationFee).toBe(0);
        expect(policy.refundAmount).toBe(5000);
        expect(
          hasuraService.executeQuery.mock.calls.some(([q]) =>
            String(q).includes('FeePercentRows')
          )
        ).toBe(false);
      }
    );

    it('does not charge a fee for unpaid pay-after cooked food', async () => {
      mockFeeRows([{ country_code: 'GA', number_value: 30 }]);
      const policy = await service.getPolicy(
        {
          ...orderWithParts,
          payment_status: 'pending',
          payment_timing: 'pay_at_pickup',
          pay_after_merchant_confirm: true,
        },
        'client'
      );
      expect(policy.cancellationFee).toBe(0);
      expect(policy.refundAmount).toBe(5000);
    });

    it('still charges 30% after pay-after cooked food is paid', async () => {
      mockFeeRows([{ country_code: 'GA', number_value: 30 }]);
      const policy = await service.getPolicy(
        {
          ...orderWithParts,
          current_status: 'preparing',
          payment_status: 'paid',
          payment_timing: 'pay_at_pickup',
          pay_after_merchant_confirm: true,
        },
        'client'
      );
      expect(policy.cancellationFee).toBe(1200);
    });

    describe('fee applicability matrix (keys on pay_after_merchant_confirm, not payment_timing)', () => {
      // Mirrored by apps/cdk/tests/test_order_status_handler_cancellation.py
      const matrix: Array<[string, boolean, string, string, boolean]> = [
        ['pay_now', true, 'pending', 'confirmed', false],
        ['pay_now', true, 'paid', 'confirmed', true],
        ['pay_at_pickup', true, 'pending', 'confirmed', false],
        ['pay_at_pickup', true, 'paid', 'preparing', true],
        ['pay_at_pickup', true, 'authorized', 'ready_for_pickup', true],
        ['pay_at_pickup', false, 'paid', 'confirmed', false],
        ['pay_at_delivery', false, 'pending', 'confirmed', false],
        ['pay_now', false, 'paid', 'confirmed', true],
        ['pay_now', false, 'paid', 'pending', false],
      ];
      it.each(matrix)(
        'timing=%s payAfter=%s payment=%s status=%s => fee applies: %s',
        async (timing, payAfter, paymentStatus, status, applies) => {
          mockFeeRows([{ country_code: 'GA', number_value: 30 }]);
          const policy = await service.getPolicy(
            {
              ...orderWithParts,
              current_status: status,
              payment_status: paymentStatus,
              payment_timing: timing,
              pay_after_merchant_confirm: payAfter,
            },
            'client'
          );
          expect(policy.cancellationFee > 0).toBe(applies);
        }
      );
    });

    it('filters quick reasons for cooked food cancel at ready', async () => {
      mockFeeRows(
        [{ country_code: 'GA', number_value: 30 }],
        [
          { id: 22, value: 'wont_make_it', display: "Won't make it" },
          { id: 2, value: 'changed_mind', display: 'Changed my mind' },
          { id: 1, value: 'other', display: 'Other' },
        ]
      );
      const policy = await service.getPolicy(
        {
          ...orderWithParts,
          current_status: 'ready_for_pickup',
          payment_status: 'paid',
          pay_after_merchant_confirm: true,
          is_cooked_food_pickup: true,
        },
        'client'
      );
      expect(policy.canCancel).toBe(true);
      expect(policy.cancellationFee).toBe(1200);
      expect(policy.availableCancellationReasons.map((r) => r.value)).toEqual([
        'wont_make_it',
        'other',
      ]);
    });

    it('returns none when fee equals total (100%)', async () => {
      mockFeeRows([{ country_code: 'GA', number_value: 100 }]);
      const policy = await service.getPolicy(
        { ...baseOrder, current_status: 'confirmed', tax_amount: 0 },
        'client'
      );
      expect(policy.refundType).toBe('none');
      expect(policy.refundAmount).toBe(0);
    });
  });

  describe('client fee split', () => {
    it('gives the merchant floor half and the platform the remainder', async () => {
      mockFeeRows([{ country_code: 'GA', number_value: 30 }]);
      const policy = await service.getPolicy(
        { ...baseOrder, current_status: 'ready_for_pickup', total_amount: 1001 },
        'client'
      );
      expect(policy.cancellationFee).toBe(300);
      expect(policy.merchantShare).toBe(150);
      expect(policy.platformShare).toBe(150);
    });

    it('charges a paid classic pay-at-pickup no-show the percent fee', async () => {
      mockFeeRows([{ country_code: 'GA', number_value: 30 }]);
      const quote = await service.quoteNoshowFee({
        ...baseOrder,
        current_status: 'ready_for_pickup',
        payment_timing: 'pay_at_pickup',
        payment_status: 'paid',
        total_amount: 1000,
      });
      expect(quote.cancellationFee).toBe(300);
      expect(quote.merchantShare).toBe(150);
      expect(quote.platformShare).toBe(150);
      expect(quote.refundAmount).toBe(700);
    });

    it('does not charge an unpaid classic pay-at-pickup no-show', async () => {
      mockFeeRows([{ country_code: 'GA', number_value: 30 }]);
      const quote = await service.quoteNoshowFee({
        ...baseOrder,
        current_status: 'ready_for_pickup',
        payment_timing: 'pay_at_pickup',
        payment_status: 'pending',
        total_amount: 1000,
      });
      expect(quote.cancellationFee).toBe(0);
      expect(quote.refundAmount).toBe(1000);
    });

    it('discloses the percent on unpaid pay-after without charging', async () => {
      mockFeeRows([{ country_code: 'GA', number_value: 30 }]);
      const policy = await service.getPolicy(
        {
          ...baseOrder,
          current_status: 'confirmed',
          pay_after_merchant_confirm: true,
          payment_status: 'pending',
          payment_timing: 'pay_at_pickup',
        },
        'client'
      );
      expect(policy.cancellationFee).toBe(0);
      expect(policy.cancellationFeePercent).toBe(30);
      expect(policy.merchantShare).toBe(0);
    });
  });

  describe('client policy — agent assigned', () => {
    it('returns canCancel=false', async () => {
      const order = { ...baseOrder, assigned_agent_id: 'agent-1' };
      const policy = await service.getPolicy(order, 'client');

      expect(policy.canCancel).toBe(false);
      expect(policy.reasonIfBlocked).toBe('blocked.agentAssigned');
    });
  });

  describe('client policy — terminal statuses', () => {
    for (const status of ['cancelled', 'refunded', 'complete', 'failed']) {
      it(`blocks cancellation for ${status}`, async () => {
        const order = { ...baseOrder, current_status: status };
        const policy = await service.getPolicy(order, 'client');

        expect(policy.canCancel).toBe(false);
      });
    }
  });

  describe('client policy — mobile money payment source', () => {
    it('returns wallet_credit refund type', async () => {
      const order = { ...baseOrder, payment_source: 'mobile_payment' };
      const policy = await service.getPolicy(order, 'client');

      expect(policy.refundType).toBe('wallet_credit');
      expect(policy.estimatedRefundProcessingTime).toBe('mobile_money_provider');
    });
  });

  describe('business policy', () => {
    it('can cancel confirmed orders with full refund', async () => {
      const order = { ...baseOrder, current_status: 'confirmed' };
      const policy = await service.getPolicy(order, 'business');

      expect(policy.canCancel).toBe(true);
      expect(policy.refundType).toBe('full');
      expect(policy.cancellationFee).toBe(0);
    });

    it('blocks cancel for paid cooked-food pay-after while preparing', async () => {
      const order = {
        ...baseOrder,
        current_status: 'preparing',
        payment_status: 'paid',
        pay_after_merchant_confirm: true,
      };
      const policy = await service.getPolicy(order, 'business');

      expect(policy.canCancel).toBe(false);
      expect(policy.reasonIfBlocked).toBe('blocked.cookedFoodPayAfterPaid');
    });

    it('allows cancel for PAID pay-after orders whose lines are not cooked (refund in full)', async () => {
      const order = {
        ...baseOrder,
        current_status: 'confirmed',
        payment_status: 'paid',
        pay_after_merchant_confirm: true,
        order_items: [{ is_cooked_food: false }],
      };
      const policy = await service.getPolicy(order, 'business');

      expect(policy.canCancel).toBe(true);
      expect(policy.refundType).toBe('full');
      expect(policy.cancellationFee).toBe(0);
    });

    it('still blocks paid pay-after orders whose lines are all cooked', async () => {
      const order = {
        ...baseOrder,
        current_status: 'confirmed',
        payment_status: 'paid',
        pay_after_merchant_confirm: true,
        order_items: [{ is_cooked_food: true }],
      };
      const policy = await service.getPolicy(order, 'business');

      expect(policy.canCancel).toBe(false);
    });

    it('allows cancel for unpaid cooked-food pay-after while confirmed', async () => {
      const order = {
        ...baseOrder,
        current_status: 'confirmed',
        payment_status: 'pending',
        pay_after_merchant_confirm: true,
      };
      const policy = await service.getPolicy(order, 'business');

      expect(policy.canCancel).toBe(true);
    });

    it('cannot cancel terminal orders', async () => {
      const order = { ...baseOrder, current_status: 'delivered' };
      const policy = await service.getPolicy(order, 'business');

      expect(policy.canCancel).toBe(false);
    });
  });

  describe('fee config for markets without their own row', () => {
    it('uses a global (NULL country) row when present', async () => {
      mockFeeRows([{ country_code: null, number_value: 20 }]);
      const policy = await service.getPolicy(
        {
          ...baseOrder,
          current_status: 'confirmed',
          tax_amount: 0,
          business_location: { country_code: 'US' },
        },
        'client'
      );
      expect(policy.cancellationFee).toBe(1000);
      expect(policy.canCancel).toBe(true);
    });
  });

  describe('consequences', () => {
    it('includes businessNotified for client cancellation', async () => {
      const policy = await service.getPolicy(baseOrder, 'client');
      expect(policy.cancellationConsequences).toContain('consequences.businessNotified');
    });

    it('includes clientNotified for business cancellation', async () => {
      const order = { ...baseOrder, current_status: 'confirmed' };
      const policy = await service.getPolicy(order, 'business');
      expect(policy.cancellationConsequences).toContain('consequences.clientNotified');
    });

    it('includes cannotBeUndone for all', async () => {
      const policy = await service.getPolicy(baseOrder, 'client');
      expect(policy.cancellationConsequences).toContain('consequences.cannotBeUndone');
    });
  });

  describe('manual capture authorization', () => {
    it('returns authorization_release for authorized credit_card pay_now', async () => {
      const policy = await service.getPolicy(
        {
          ...baseOrder,
          current_status: 'confirmed',
          payment_status: 'authorized',
        },
        'client'
      );
      expect(policy.refundType).toBe('authorization_release');
      expect(policy.estimatedRefundProcessingTime).toBe(
        'authorization_release_immediate'
      );
    });
  });
});
