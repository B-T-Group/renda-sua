import { Test, TestingModule } from '@nestjs/testing';
import {
  DepositCalculationService,
  MOMO_DEPOSIT_MIN_XAF,
} from './deposit-calculation.service';

describe('DepositCalculationService', () => {
  let service: DepositCalculationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DepositCalculationService],
    }).compile();

    service = module.get<DepositCalculationService>(DepositCalculationService);
  });

  describe('calculateItemDeposit', () => {
    it('sums opted-in item percents and ignores delivery in the base', () => {
      const result = service.calculateItemDeposit({
        currency: 'XAF',
        orderTotal: 6000,
        lines: [
          {
            unitPrice: 4000,
            quantity: 1,
            initialDepositEnabled: true,
            initialDepositPercent: 10,
          },
        ],
      });

      expect(result.depositAmount).toBe(400);
      expect(result.percent).toBe(10);
      expect(result.minimumApplied).toBe(false);
      expect(result.amountDue).toBe(5600);
      expect(result.lines[0]).toEqual({
        initialDepositPercent: 10,
        initialDepositAmount: 400,
      });
    });

    it('uses each line percent when a cart mixes rates', () => {
      const result = service.calculateItemDeposit({
        currency: 'GNF',
        orderTotal: 3000,
        lines: [
          {
            unitPrice: 1000,
            quantity: 1,
            initialDepositEnabled: true,
            initialDepositPercent: 10,
          },
          {
            unitPrice: 1000,
            quantity: 2,
            initialDepositEnabled: true,
            initialDepositPercent: 20,
          },
        ],
      });

      expect(result.depositAmount).toBe(500);
      expect(result.percent).toBeNull();
      expect(result.lines[1]?.initialDepositAmount).toBe(400);
    });

    it('raises XAF deposits under 150 to the minimum and caps at the order total', () => {
      const small = service.calculateItemDeposit({
        currency: 'XAF',
        orderTotal: 1000,
        lines: [
          {
            unitPrice: 1000,
            quantity: 1,
            initialDepositEnabled: true,
            initialDepositPercent: 10,
          },
        ],
      });
      const tiny = service.calculateItemDeposit({
        currency: 'XAF',
        orderTotal: 100,
        lines: [
          {
            unitPrice: 100,
            quantity: 1,
            initialDepositEnabled: true,
            initialDepositPercent: 10,
          },
        ],
      });

      expect(small.depositAmount).toBe(MOMO_DEPOSIT_MIN_XAF);
      expect(small.minimumApplied).toBe(true);
      expect(small.percent).toBeNull();
      expect(small.amountDue).toBe(850);
      expect(tiny.depositAmount).toBe(100);
      expect(tiny.minimumApplied).toBe(true);
      expect(tiny.amountDue).toBe(0);
    });

    it('does not apply the XAF floor to other currencies', () => {
      const result = service.calculateItemDeposit({
        currency: 'GNF',
        orderTotal: 1000,
        lines: [
          {
            unitPrice: 1000,
            quantity: 1,
            initialDepositEnabled: true,
            initialDepositPercent: 5,
          },
        ],
      });

      expect(result.depositAmount).toBe(50);
      expect(result.minimumApplied).toBe(false);
    });

    it('returns zero when nothing is opted in', () => {
      const result = service.calculateItemDeposit({
        currency: 'XAF',
        orderTotal: 10000,
        lines: [
          {
            unitPrice: 10000,
            quantity: 1,
            initialDepositEnabled: false,
            initialDepositPercent: null,
          },
        ],
      });

      expect(result.depositAmount).toBe(0);
      expect(result.amountDue).toBe(10000);
      expect(result.lines[0]?.initialDepositAmount).toBeNull();
    });

    it('ignores cooked-food lines even when a deposit flag is set', () => {
      const result = service.calculateItemDeposit({
        currency: 'XAF',
        orderTotal: 5000,
        lines: [
          {
            unitPrice: 2000,
            quantity: 1,
            initialDepositEnabled: true,
            initialDepositPercent: 25,
            isCookedFood: true,
          },
          {
            unitPrice: 3000,
            quantity: 1,
            initialDepositEnabled: false,
          },
        ],
      });

      expect(result.depositAmount).toBe(0);
    });

    it('throws when the order total is negative', () => {
      expect(() =>
        service.calculateItemDeposit({
          currency: 'XAF',
          orderTotal: -1,
          lines: [],
        })
      ).toThrow('Grand total cannot be negative');
    });
  });

  describe('remainderPaymentAmount', () => {
    it('returns total minus deposit when deposit is paid', () => {
      expect(
        service.remainderPaymentAmount({
          total_amount: 200,
          deposit_amount: 150,
          deposit_status: 'paid',
        })
      ).toBe(50);
    });

    it('returns total minus deposit when deposit is applied (counted at settlement / cash exception)', () => {
      expect(
        service.remainderPaymentAmount({
          total_amount: 5000,
          deposit_amount: 500,
          deposit_status: 'applied',
        })
      ).toBe(4500);
    });

    it('returns full total when the deposit was forfeited or refunded', () => {
      for (const deposit_status of ['forfeited', 'refunded', 'failed']) {
        expect(
          service.remainderPaymentAmount({
            total_amount: 5000,
            deposit_amount: 500,
            deposit_status,
          })
        ).toBe(5000);
      }
    });

    it('returns full total when deposit is pending', () => {
      expect(
        service.remainderPaymentAmount({
          total_amount: 200,
          deposit_amount: 150,
          deposit_status: 'pending',
        })
      ).toBe(200);
    });

    it('returns full total when deposit_status is none or missing', () => {
      expect(
        service.remainderPaymentAmount({
          total_amount: 200,
          deposit_amount: 0,
          deposit_status: 'none',
        })
      ).toBe(200);
      expect(service.remainderPaymentAmount({ total_amount: 200 })).toBe(200);
    });

    it('clamps remainder at zero when deposit exceeds total', () => {
      expect(
        service.remainderPaymentAmount({
          total_amount: 100,
          deposit_amount: 150,
          deposit_status: 'paid',
        })
      ).toBe(0);
    });
  });

  describe('isDepositRequired', () => {
    it('should require deposit for pay_at_delivery on mobile_money', () => {
      expect(
        service.isDepositRequired('pay_at_delivery', 'mobile_money')
      ).toBe(true);
    });

    it('should require deposit for pay_at_pickup on mobile_money', () => {
      expect(service.isDepositRequired('pay_at_pickup', 'mobile_money')).toBe(
        true
      );
    });

    it('should not require deposit for pay_now', () => {
      expect(service.isDepositRequired('pay_now', 'mobile_money')).toBe(false);
    });

    it('should not require deposit for stripe rail', () => {
      expect(service.isDepositRequired('pay_at_delivery', 'stripe')).toBe(
        false
      );
    });

    it('should not require deposit for wallet rail', () => {
      expect(service.isDepositRequired('pay_at_delivery', 'wallet')).toBe(
        false
      );
    });
  });

  describe('isAfterRefundLockPoint', () => {
    describe('delivery fulfillment', () => {
      it('should return false before lock point', () => {
        expect(service.isAfterRefundLockPoint('delivery', 'pending')).toBe(
          false
        );
        expect(service.isAfterRefundLockPoint('delivery', 'confirmed')).toBe(
          false
        );
        expect(service.isAfterRefundLockPoint('delivery', 'preparing')).toBe(
          false
        );
      });

      it('should return true at lock point (out_for_delivery)', () => {
        expect(
          service.isAfterRefundLockPoint('delivery', 'out_for_delivery')
        ).toBe(true);
      });

      it('should return true after delivery', () => {
        expect(service.isAfterRefundLockPoint('delivery', 'delivered')).toBe(
          true
        );
      });
    });

    describe('pickup fulfillment', () => {
      it('should return false before lock point', () => {
        expect(service.isAfterRefundLockPoint('pickup', 'pending')).toBe(false);
        expect(service.isAfterRefundLockPoint('pickup', 'confirmed')).toBe(
          false
        );
        expect(service.isAfterRefundLockPoint('pickup', 'preparing')).toBe(
          false
        );
      });

      it('should return true at lock point (ready_for_pickup)', () => {
        expect(
          service.isAfterRefundLockPoint('pickup', 'ready_for_pickup')
        ).toBe(true);
      });

      it('should return true after pickup', () => {
        expect(service.isAfterRefundLockPoint('pickup', 'picked_up')).toBe(true);
      });
    });

    describe('shipping fulfillment', () => {
      it('should treat shipping like delivery', () => {
        expect(service.isAfterRefundLockPoint('shipping', 'pending')).toBe(
          false
        );
        expect(
          service.isAfterRefundLockPoint('shipping', 'out_for_delivery')
        ).toBe(true);
        expect(service.isAfterRefundLockPoint('shipping', 'delivered')).toBe(
          true
        );
      });
    });
  });
});
