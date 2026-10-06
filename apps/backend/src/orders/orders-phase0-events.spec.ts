import { OrdersService } from './orders.service';

function mockOrder() {
  return {
    id: 'order-123',
    order_number: 'ORD-001',
    current_status: 'ready_for_pickup',
    subtotal: 10000,
    currency: 'XAF',
    business_id: 'biz-123',
    business_location: {
      address: {
        city: 'Douala',
        state: 'Littoral',
      },
    },
    assigned_agent_id: null,
    verified_agent_delivery: false,
  };
}

function mockAgent() {
  return {
    id: 'agent-123',
    is_verified: true,
    is_internal: false,
  };
}

function mockUser() {
  return {
    id: 'user-123',
    first_name: 'Jane',
    last_name: 'Agent',
    agent: mockAgent(),
    active_persona: 'agent',
  };
}

function createHarness() {
  const trackEvent = jest.fn().mockResolvedValue(undefined);
  const hasuraSystemService = {
    executeQuery: jest.fn().mockResolvedValue({
      agents_by_pk: { status: 'active' },
    }),
    getAccount: jest.fn().mockResolvedValue({
      id: 'account-123',
      available_balance: 5000,
    }),
    getAccountById: jest.fn().mockResolvedValue({
      id: 'account-123',
      user_id: 'user-123',
    }),
    getUserById: jest.fn().mockResolvedValue(mockUser()),
  };
  const service = Object.create(OrdersService.prototype) as OrdersService;
  Object.assign(service, {
    hasuraUserService: {
      getUser: jest.fn().mockResolvedValue(mockUser()),
      sessionPersonaContext: jest.fn().mockReturnValue({
        jwtDefaultRole: 'agent',
        jwtAllowedRoles: ['agent'],
      }),
    },
    hasuraSystemService,
    mobilePaymentsDatabaseService: {
      hasPendingClaimOrderForOrderNumber: jest.fn().mockResolvedValue(false),
      getPendingClaimOrderTransactionForUserAndOrderNumber: jest.fn().mockResolvedValue(null),
    },
    siteEventsService: { trackEvent },
    logger: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
  });

  jest.spyOn(service as any, 'getOrderWithItems').mockResolvedValue(mockOrder());
  jest.spyOn(service as any, 'requireAgentRecord').mockReturnValue(mockAgent());
  jest.spyOn(service as any, 'requireActivePersona').mockReturnValue(undefined);
  jest.spyOn(service as any, 'assertAgentVerifiedForClaim').mockReturnValue(undefined);
  jest.spyOn(service as any, 'assertClaimableFulfillment').mockReturnValue(undefined);
  jest.spyOn(service as any, 'getAgentStatus').mockResolvedValue('active');
  jest.spyOn(service as any, 'resolveOrderHoldAmount').mockResolvedValue({
    rail: 'mobile_money',
    holdPercentage: 80,
    holdAmount: 8000,
  });

  return { service, trackEvent, hasuraSystemService };
}

describe('OrdersService Phase 0 Events', () => {
  describe('claimOrder funds check before 403', () => {
    it('emits agent.claim_funds_check before throwing 403 on insufficient funds', async () => {
      const harness = createHarness();
      harness.hasuraSystemService.getAccount.mockResolvedValue({
        id: 'account-123',
        available_balance: 3000, // Less than holdAmount (8000)
      });

      let error: any;
      try {
        await harness.service.claimOrder({ orderId: 'order-123' });
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.status).toBe(403);

      // Wait for async emission
      await new Promise((resolve) => setImmediate(resolve));

      expect(harness.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'agent.claim_funds_check',
          metadata: expect.objectContaining({
            orderId: 'order-123',
            orderNumber: 'ORD-001',
            agentId: 'agent-123',
            city: 'Douala',
            state: 'Littoral',
            subtotal: 10000,
            currency: 'XAF',
            holdPercentage: 80,
            holdAmount: 8000,
            availableBalance: 3000,
            needsTopUp: true,
            hasEnoughFunds: false,
            rail: 'mobile_money',
            source: 'claim',
          }),
        }),
        expect.objectContaining({
          viewerType: 'server',
          viewerId: 'system',
        })
      );
    });
  });

  describe('acceptOrderOffer', () => {
    it('emits funds check with source offer_accept', async () => {
      const harness = createHarness();
      harness.hasuraSystemService.getAccount.mockResolvedValue({
        id: 'account-123',
        available_balance: 10000, // Sufficient balance >= holdAmount (8000)
      });
      
      const mockOrderOffersService = {
        getActiveOfferForAgent: jest.fn().mockResolvedValue({ id: 'offer-1' }),
      };
      Object.assign(harness.service, {
        orderOffersService: mockOrderOffersService,
        assignOrderToAgent: jest.fn().mockResolvedValue({ id: 'order-123' }),
        getOrCreateOrderHold: jest.fn().mockResolvedValue({ id: 'hold-1' }),
        updateOrderHold: jest.fn().mockResolvedValue(undefined),
        requireSuccessfulHold: jest.fn().mockResolvedValue(undefined),
        createStatusHistoryEntry: jest.fn().mockResolvedValue(undefined),
        onOrderAssignedToAgent: jest.fn().mockResolvedValue(undefined),
      });

      await harness.service.acceptOrderOffer({ orderId: 'order-123' });

      await new Promise((resolve) => setImmediate(resolve));

      expect(harness.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'agent.claim_funds_check',
          metadata: expect.objectContaining({
            source: 'offer_accept',
          }),
        }),
        expect.any(Object)
      );
    });
  });

  describe('processClaimOrderPayment', () => {
    it('emits topup_succeeded once on slot assigned', async () => {
      const harness = createHarness();
      const mockTransaction = {
        id: 'tx-123',
        entity_id: 'ORD-001',
        reference: 'REF-123',
        amount: 8000,
        currency: 'XAF',
        transaction_id: 'momo-tx-123',
        provider: 'mtn_momo_cm',
        account_id: 'account-123',
        created_at: new Date().toISOString(),
      };

      jest.spyOn(harness.service as any, 'getOrderForProcessingByNumber').mockResolvedValue(mockOrder());
      jest.spyOn(harness.service as any, 'loadClaimPaymentContext').mockResolvedValue({
        order: mockOrder(),
        agentId: 'agent-123',
        accountId: 'account-123',
      });
      jest.spyOn(harness.service as any, 'assignClaimIfOpen').mockResolvedValue('assigned');
      jest.spyOn(harness.service as any, 'placeClaimHoldOrRevert').mockResolvedValue(undefined);
      jest.spyOn(harness.service as any, 'recordNewClaimAssignment').mockResolvedValue(undefined);
      jest.spyOn(harness.service as any, 'claimPaymentDoneMessage').mockReturnValue('Done');

      await harness.service.processClaimOrderPayment(mockTransaction);

      await new Promise((resolve) => setImmediate(resolve));

      expect(harness.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'agent.claim_topup_succeeded',
          metadata: expect.objectContaining({
            orderId: 'order-123',
            orderNumber: 'ORD-001',
            agentId: 'agent-123',
            holdAmount: 8000,
            transactionId: 'momo-tx-123',
          }),
        }),
        expect.any(Object)
      );
    });

    it('does not emit on slot already-mine (replay)', async () => {
      const harness = createHarness();
      const mockTransaction = {
        id: 'tx-123',
        entity_id: 'ORD-001',
        amount: 8000,
        account_id: 'account-123',
        created_at: new Date().toISOString(),
      };

      jest.spyOn(harness.service as any, 'loadClaimPaymentContext').mockResolvedValue({
        order: mockOrder(),
        agentId: 'agent-123',
        accountId: 'account-123',
      });
      jest.spyOn(harness.service as any, 'assignClaimIfOpen').mockResolvedValue('already-mine');
      jest.spyOn(harness.service as any, 'placeClaimHoldOrRevert').mockResolvedValue(undefined);
      jest.spyOn(harness.service as any, 'claimPaymentDoneMessage').mockReturnValue('Done');

      await harness.service.processClaimOrderPayment(mockTransaction);

      await new Promise((resolve) => setImmediate(resolve));

      expect(harness.trackEvent).not.toHaveBeenCalled();
    });
  });

  describe('cancelClaimRequest', () => {
    it('emits cancel event with real holdAmount', async () => {
      const harness = createHarness();
      const mockPendingTransaction = {
        id: 'tx-123',
        transaction_id: 'prov-tx-123',
        provider: 'mtn_momo_cm',
        amount: 8000,
        currency: 'XAF',
      };

      Object.assign(harness.service, {
        mobilePaymentsDatabaseService: {
          getPendingClaimOrderTransactionForUserAndOrderNumber: jest
            .fn()
            .mockResolvedValue(mockPendingTransaction),
          updateTransaction: jest.fn().mockResolvedValue(undefined),
        },
        mobilePaymentsService: {
          cancelTransaction: jest.fn().mockResolvedValue(true),
        },
      });

      await harness.service.cancelClaimRequest({ orderId: 'order-123' });

      await new Promise((resolve) => setImmediate(resolve));

      expect(harness.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'agent.claim_topup_cancelled',
          metadata: expect.objectContaining({
            orderId: 'order-123',
            orderNumber: 'ORD-001',
            agentId: 'agent-123',
            holdAmount: 8000,
            currency: 'XAF',
          }),
        }),
        expect.any(Object)
      );
    });
  });
});
