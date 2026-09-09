import { Test, TestingModule } from '@nestjs/testing';
import { DepositCalculationService, MOMO_DEPOSIT_MIN_XAF } from './deposit-calculation.service';

describe('DepositCalculationService', () => {
  let service: DepositCalculationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DepositCalculationService],
    }).compile();

    service = module.get<DepositCalculationService>(DepositCalculationService);
  });

  describe('calculateDeposit', () => {
    it('should calculate 10% deposit for orders under 5000 XAF', () => {
      const result = service.calculateDeposit(1000, 'XAF');
      
      expect(result.depositAmount).toBe(MOMO_DEPOSIT_MIN_XAF); // floor wins (100 < 150)
      expect(result.rate).toBe(0.10);
      expect(result.amountDue).toBe(1000 - MOMO_DEPOSIT_MIN_XAF);
      expect(result.totalAmount).toBe(1000);
    });

    it('should calculate 10% deposit for orders just under threshold', () => {
      const result = service.calculateDeposit(4999, 'XAF');
      
      expect(result.depositAmount).toBe(500); // round(4999 * 0.10) = 500
      expect(result.rate).toBe(0.10);
      expect(result.amountDue).toBe(4499);
      expect(result.totalAmount).toBe(4999);
    });

    it('should calculate 5% deposit for orders at 5000 XAF', () => {
      const result = service.calculateDeposit(5000, 'XAF');
      
      expect(result.depositAmount).toBe(250); // round(5000 * 0.05) = 250
      expect(result.rate).toBe(0.05);
      expect(result.amountDue).toBe(4750);
      expect(result.totalAmount).toBe(5000);
    });

    it('should calculate 5% deposit for large orders', () => {
      const result = service.calculateDeposit(20000, 'XAF');
      
      expect(result.depositAmount).toBe(1000); // round(20000 * 0.05) = 1000
      expect(result.rate).toBe(0.05);
      expect(result.amountDue).toBe(19000);
      expect(result.totalAmount).toBe(20000);
    });

    it('should enforce floor for tiny orders', () => {
      const result = service.calculateDeposit(100, 'XAF');
      
      expect(result.depositAmount).toBe(MOMO_DEPOSIT_MIN_XAF); // floor wins (10 < 150)
      expect(result.rate).toBe(0.10);
      expect(result.amountDue).toBe(0); // can't be negative
      expect(result.totalAmount).toBe(100);
    });

    it('should handle edge case where deposit equals total', () => {
      const result = service.calculateDeposit(MOMO_DEPOSIT_MIN_XAF, 'XAF');
      
      expect(result.depositAmount).toBe(MOMO_DEPOSIT_MIN_XAF);
      expect(result.amountDue).toBe(0);
    });

    it('should round fractional amounts', () => {
      const result = service.calculateDeposit(2567, 'XAF');
      
      // 2567 * 0.10 = 256.7 → round to 257
      expect(result.depositAmount).toBe(257);
      expect(result.amountDue).toBe(2310);
    });

    it('should throw error for non-XAF currency', () => {
      expect(() => service.calculateDeposit(1000, 'USD')).toThrow(
        'Deposit calculation only supported for XAF'
      );
    });

    it('should throw error for negative total', () => {
      expect(() => service.calculateDeposit(-100, 'XAF')).toThrow(
        'Grand total cannot be negative'
      );
    });

    it('should handle zero amount', () => {
      const result = service.calculateDeposit(0, 'XAF');
      
      expect(result.depositAmount).toBe(MOMO_DEPOSIT_MIN_XAF);
      expect(result.amountDue).toBe(0);
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
      expect(
        service.isDepositRequired('pay_at_pickup', 'mobile_money')
      ).toBe(true);
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
        expect(
          service.isAfterRefundLockPoint('delivery', 'preparing')
        ).toBe(false);
      });

      it('should return true at lock point (out_for_delivery)', () => {
        expect(
          service.isAfterRefundLockPoint('delivery', 'out_for_delivery')
        ).toBe(true);
      });

      it('should return true after delivery', () => {
        expect(
          service.isAfterRefundLockPoint('delivery', 'delivered')
        ).toBe(true);
      });
    });

    describe('pickup fulfillment', () => {
      it('should return false before lock point', () => {
        expect(service.isAfterRefundLockPoint('pickup', 'pending')).toBe(
          false
        );
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
        expect(service.isAfterRefundLockPoint('pickup', 'picked_up')).toBe(
          true
        );
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
