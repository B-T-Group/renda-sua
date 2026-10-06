import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { SiteEventsService } from '../site-events/site-events.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { AgentHoldService } from '../agents/agent-hold.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import { MobilePaymentsDatabaseService } from '../mobile-payments/mobile-payments-database.service';

/**
 * Phase 0 (#453): Agent claim friction & delivery availability events.
 * Tests that site_events are emitted correctly without subject-based dedupe.
 */
describe('OrdersService Phase 0 Events', () => {
  let service: OrdersService;
  let siteEventsService: jest.Mocked<SiteEventsService>;
  let hasuraUserService: jest.Mocked<HasuraUserService>;
  let hasuraSystemService: jest.Mocked<HasuraSystemService>;

  const mockAgent = {
    id: 'agent-123',
    is_verified: true,
    is_internal: false,
  };

  const mockAgentUser = {
    id: 'user-123',
    first_name: 'Jane',
    last_name: 'Agent',
    agent: mockAgent,
    active_persona: 'agent',
  } as any;

  const mockOrder = {
    id: 'order-123',
    order_number: 'ORD-001',
    current_status: 'ready_for_pickup',
    subtotal: 10000,
    currency: 'XAF',
    business_id: 'biz-123',
    assigned_agent_id: null,
    verified_agent_delivery: false,
    pickup_address: {
      city: 'Douala',
      state: 'Littoral',
    },
  } as any;

  beforeEach(async () => {
    const mockSiteEventsService = {
      trackEvent: jest.fn().mockResolvedValue(undefined),
    };

    const mockHasuraUserService = {
      getUser: jest.fn().mockResolvedValue(mockAgentUser),
    };

    const mockHasuraSystemService = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn(),
      getAccount: jest.fn().mockResolvedValue({
        id: 'account-123',
        available_balance: 5000,
      }),
      getAccountById: jest.fn(),
      getUserById: jest.fn(),
    };

    const mockAgentHoldService = {
      getHoldPercentageForAgent: jest.fn().mockResolvedValue(80),
    };

    const mockPaymentRoutingService = {
      resolveRailForBusiness: jest.fn().mockResolvedValue('mobile_money'),
    };

    const mockMobilePaymentsDatabaseService = {
      hasPendingClaimOrderForOrderNumber: jest.fn().mockResolvedValue(false),
      getPendingClaimOrderTransactionForUserAndOrderNumber: jest.fn(),
      updateTransaction: jest.fn(),
      createTransaction: jest.fn(),
    };

    // Minimal module with mocked dependencies
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: SiteEventsService, useValue: mockSiteEventsService },
        { provide: HasuraUserService, useValue: mockHasuraUserService },
        { provide: HasuraSystemService, useValue: mockHasuraSystemService },
        { provide: AgentHoldService, useValue: mockAgentHoldService },
        {
          provide: PaymentRoutingService,
          useValue: mockPaymentRoutingService,
        },
        {
          provide: MobilePaymentsDatabaseService,
          useValue: mockMobilePaymentsDatabaseService,
        },
        // Stub all other required dependencies
        { provide: 'AccountsService', useValue: {} },
        { provide: 'ConfigService', useValue: { get: jest.fn() } },
        { provide: 'OrderStatusService', useValue: {} },
        { provide: 'GoogleDistanceService', useValue: {} },
        { provide: 'AddressesService', useValue: {} },
        { provide: 'MobilePaymentsService', useValue: {} },
        { provide: 'MobilePaymentPhonesService', useValue: {} },
        { provide: 'NotificationsService', useValue: {} },
        { provide: 'OrderRecipientNotificationsService', useValue: {} },
        { provide: 'FxEstimateService', useValue: {} },
        { provide: 'RecipientsService', useValue: {} },
        { provide: 'DeliveryConfigService', useValue: {} },
        { provide: 'DeliveryWindowsService', useValue: {} },
        { provide: 'CommissionsService', useValue: {} },
        { provide: 'PdfService', useValue: {} },
        { provide: 'OrderQueueService', useValue: {} },
        { provide: 'WaitAndExecuteScheduleService', useValue: {} },
        { provide: 'DeliveryPinService', useValue: {} },
        { provide: 'DeliveryPinShareService', useValue: {} },
        { provide: 'OrderRefundsService', useValue: {} },
        { provide: 'LoyaltyService', useValue: {} },
        { provide: 'StripeCheckoutService', useValue: {} },
        { provide: 'StripeCaptureService', useValue: {} },
        { provide: 'StripeRefundService', useValue: {} },
        { provide: 'StripeTaxCheckoutBuilderService', useValue: {} },
        { provide: 'StripeTaxCalculationService', useValue: {} },
        { provide: 'OrderOffersService', useValue: {} },
        { provide: 'CancellationPolicyService', useValue: {} },
        { provide: 'LocationsService', useValue: {} },
        { provide: 'OrderSystemJobsService', useValue: {} },
        { provide: 'OrderCleanupService', useValue: {} },
        { provide: 'OrderAcceptanceService', useValue: {} },
        { provide: 'FulfillmentPromiseService', useValue: {} },
        { provide: 'OrderMarkReadyService', useValue: {} },
        { provide: 'OrderPickupMonitorService', useValue: {} },
        { provide: 'OrderReassignmentService', useValue: {} },
        { provide: 'OrderEventsService', useValue: {} },
        { provide: 'RbacService', useValue: {} },
        { provide: 'DeliveryAvailabilityService', useValue: {} },
        { provide: 'EventEmitter2', useValue: { emit: jest.fn() } },
        { provide: 'FoodOrdersService', useValue: {} },
        { provide: 'CookedFoodPickupFlowService', useValue: {} },
        { provide: 'DepositCalculationService', useValue: {} },
        { provide: 'DepositLedgerService', useValue: {} },
        { provide: 'DepositRefundService', useValue: {} },
        { provide: 'VariantInventoryService', useValue: {} },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    siteEventsService = module.get(SiteEventsService);
    hasuraUserService = module.get(HasuraUserService);
    hasuraSystemService = module.get(HasuraSystemService);

    // Mock private method getOrderWithItems
    jest
      .spyOn(service as any, 'getOrderWithItems')
      .mockResolvedValue(mockOrder);
    jest.spyOn(service as any, 'getAgentStatus').mockResolvedValue('active');
    jest.spyOn(service as any, 'requireAgentRecord').mockReturnValue(mockAgent);
    jest
      .spyOn(service as any, 'requireActivePersona')
      .mockImplementation(() => {});
    jest
      .spyOn(service as any, 'assertAgentVerifiedForClaim')
      .mockImplementation(() => {});
  });

  describe('checkOrderClaimAvailability', () => {
    it('should emit agent.claim_funds_check event on success', async () => {
      const result = await service.checkOrderClaimAvailability('order-123');

      // Wait for async emission
      await new Promise((resolve) => setImmediate(resolve));

      expect(result.success).toBe(true);
      expect(siteEventsService.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'agent.claim_funds_check',
          metadata: expect.objectContaining({
            orderId: 'order-123',
            orderNumber: 'ORD-001',
            agentId: 'agent-123',
            city: null,
            state: null,
            subtotal: 10000,
            currency: 'XAF',
            holdPercentage: 80,
            holdAmount: 8000,
            availableBalance: 5000,
            needsTopUp: true,
            hasEnoughFunds: false,
            shortfall: 3000,
            rail: 'mobile_money',
            source: 'availability',
          }),
          subjectType: undefined,
          subjectId: undefined,
        }),
        expect.objectContaining({
          viewerType: 'server',
          viewerId: 'system',
        })
      );
    });

    it('should allow repeated calls without dedupe', async () => {
      await service.checkOrderClaimAvailability('order-123');
      await service.checkOrderClaimAvailability('order-123');

      await new Promise((resolve) => setImmediate(resolve));

      expect(siteEventsService.trackEvent).toHaveBeenCalledTimes(2);
    });

    it('should not throw if event emission fails', async () => {
      siteEventsService.trackEvent.mockRejectedValue(
        new Error('Insert failed')
      );

      const result = await service.checkOrderClaimAvailability('order-123');

      expect(result.success).toBe(true);
    });
  });

  describe('emitClaimTopupFailed', () => {
    it('should emit agent.claim_topup_failed event', async () => {
      const mockTransaction = {
        id: 'tx-123',
        entity_id: 'ORD-001',
        reference: 'REF-123',
        amount: 8000,
        currency: 'XAF',
        transaction_id: 'momo-tx-123',
        provider: 'mtn_momo_cm',
        account_id: 'account-123',
      } as any;

      hasuraSystemService.executeQuery.mockResolvedValue({
        orders: [mockOrder],
      });
      hasuraSystemService.getAccountById.mockResolvedValue({
        id: 'account-123',
        user_id: 'user-123',
      });
      hasuraSystemService.getUserById.mockResolvedValue(mockAgentUser);

      jest
        .spyOn(service as any, 'getOrderForProcessingByNumber')
        .mockResolvedValue(mockOrder);

      await service.emitClaimTopupFailed(mockTransaction, 'Payment timeout');

      await new Promise((resolve) => setImmediate(resolve));

      expect(siteEventsService.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'agent.claim_topup_failed',
          metadata: expect.objectContaining({
            orderId: 'order-123',
            orderNumber: 'ORD-001',
            agentId: 'agent-123',
            holdAmount: 8000,
            transactionId: 'momo-tx-123',
            provider: 'mtn_momo_cm',
            currency: 'XAF',
            reason: 'Payment timeout',
          }),
          subjectType: undefined,
          subjectId: undefined,
        }),
        expect.objectContaining({
          viewerType: 'server',
          viewerId: 'system',
        })
      );
    });

    it('should not throw if lookup fails', async () => {
      const mockTransaction = {
        id: 'tx-123',
        entity_id: 'MISSING',
        account_id: 'account-123',
      } as any;

      jest
        .spyOn(service as any, 'getOrderForProcessingByNumber')
        .mockRejectedValue(new Error('Order not found'));

      await expect(
        service.emitClaimTopupFailed(mockTransaction, 'Failed')
      ).resolves.not.toThrow();
    });
  });
});
