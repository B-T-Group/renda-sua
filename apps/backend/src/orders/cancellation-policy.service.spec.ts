import { Test, TestingModule } from '@nestjs/testing';
import { CancellationPolicyService } from './cancellation-policy.service';

jest.mock('../admin/configurations.service', () => ({
  ConfigurationsService: class ConfigurationsService {},
}));
jest.mock('../hasura/hasura-system.service', () => ({
  HasuraSystemService: class HasuraSystemService {},
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ConfigurationsService } = require('../admin/configurations.service');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { HasuraSystemService } = require('../hasura/hasura-system.service');

describe('CancellationPolicyService', () => {
  let service: CancellationPolicyService;
  let configurationsService: jest.Mocked<Pick<ConfigurationsService, 'getConfigurationByKey'>>;
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

  beforeEach(async () => {
    configurationsService = {
      getConfigurationByKey: jest.fn().mockResolvedValue(null),
    };
    hasuraService = {
      executeQuery: jest.fn().mockResolvedValue({
        order_cancellation_reasons: clientReasons,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CancellationPolicyService,
        { provide: ConfigurationsService, useValue: configurationsService },
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

  describe('client policy — confirmed status, fee applies', () => {
    it('returns partial refund when cancellation fee is configured', async () => {
      configurationsService.getConfigurationByKey.mockResolvedValue({
        number_value: 500,
      } as any);

      const order = { ...baseOrder, current_status: 'confirmed' };
      const policy = await service.getPolicy(order, 'client');

      expect(policy.canCancel).toBe(true);
      expect(policy.refundType).toBe('partial');
      expect(policy.cancellationFee).toBe(500);
      expect(policy.refundAmount).toBe(4500);
    });

    it('returns none when fee equals total', async () => {
      configurationsService.getConfigurationByKey.mockResolvedValue({
        number_value: 5000,
      } as any);

      const order = { ...baseOrder, current_status: 'confirmed' };
      const policy = await service.getPolicy(order, 'client');

      expect(policy.refundType).toBe('none');
      expect(policy.refundAmount).toBe(0);
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

    it('cannot cancel terminal orders', async () => {
      const order = { ...baseOrder, current_status: 'delivered' };
      const policy = await service.getPolicy(order, 'business');

      expect(policy.canCancel).toBe(false);
    });
  });

  describe('fee config fallback', () => {
    it('returns fee=0 when config is missing for country', async () => {
      configurationsService.getConfigurationByKey.mockResolvedValue(null);

      const order = {
        ...baseOrder,
        current_status: 'confirmed',
        business_location: { country_code: 'US' },
      };
      const policy = await service.getPolicy(order, 'client');

      expect(policy.cancellationFee).toBe(0);
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
