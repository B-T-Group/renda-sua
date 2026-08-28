jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { AgentHoldService } from '../agents/agent-hold.service';
import { AccountsService } from '../accounts/accounts.service';
import { AddressesService } from '../addresses/addresses.service';
import { CommissionsService } from '../commissions/commissions.service';
import type { Configuration } from '../config/configuration';
import { DeliveryConfigService } from '../delivery-configs/delivery-configs.service';
import { DeliveryWindowsService } from '../delivery/delivery-windows.service';
import { GoogleDistanceService } from '../google/google-distance.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { MobilePaymentsDatabaseService } from '../mobile-payments/mobile-payments-database.service';
import { MobilePaymentsService } from '../mobile-payments/mobile-payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PdfService } from '../pdf/pdf.service';
import { DeliveryPinService } from '../delivery-pin/delivery-pin.service';
import { DeliveryPinShareService } from '../messaging/structured/delivery-pin-share.service';
import { OrderQueueService } from './order-queue.service';
import { OrderRefundsService } from './order-refunds.service';
import { OrderStatusService } from './order-status.service';
import { OrdersService } from './orders.service';
import { WaitAndExecuteScheduleService } from './wait-and-execute-schedule.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import { StripeCaptureService } from '../stripe-payments/stripe-capture.service';
import { StripeCheckoutService } from '../stripe-payments/stripe-checkout.service';
import { StripeTaxCalculationService } from '../stripe-tax/stripe-tax-calculation.service';
import { StripeTaxCheckoutBuilderService } from '../stripe-tax/stripe-tax-checkout-builder.service';
import { RbacService } from '../rbac/rbac.service';
import { CancellationPolicyService } from './cancellation-policy.service';
import { OrderOffersService } from './order-offers.service';
import { OrderSystemJobsService } from './order-system-jobs.service';
import { OrderAcceptanceService } from './order-acceptance.service';
import { FulfillmentPromiseService } from './fulfillment-promise.service';
import { OrderEventsService } from './order-events.service';
import { OrderPickupMonitorService } from './order-pickup-monitor.service';
import { OrderReassignmentService } from './order-reassignment.service';
import { LocationsService } from '../locations/locations.service';
import { DeliveryAvailabilityService } from '../delivery-availability/delivery-availability.service';
import { FoodOrdersService } from '../food/food-orders.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let hasuraUserService: jest.Mocked<HasuraUserService>;
  let hasuraSystemService: jest.Mocked<HasuraSystemService>;
  let configService: jest.Mocked<ConfigService<Configuration>>;
  let agentHoldService: jest.Mocked<AgentHoldService>;
  let accountsService: jest.Mocked<any>;
  let orderStatusService: jest.Mocked<any>;
  let stripeCaptureService: jest.Mocked<StripeCaptureService>;

  const mockUser = {
    id: 'user-123',
    email: 'john.doe@example.com',
    first_name: 'John',
    last_name: 'Doe',
    user_type_id: 'business',
    active_persona: 'business',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    business: { id: 'business-123', user_id: 'user-123' },
    agent: null,
  } as any;

  const mockAgentUser = {
    id: 'agent-123',
    email: 'jane.smith@example.com',
    first_name: 'Jane',
    last_name: 'Smith',
    user_type_id: 'agent',
    active_persona: 'agent',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    business: null,
    agent: { id: 'agent-123', user_id: 'agent-123' },
  } as any;

  const mockClientUser = {
    id: 'client-456',
    email: 'client@example.com',
    first_name: 'Client',
    last_name: 'User',
    user_type_id: 'client',
    active_persona: 'client',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    business: null,
    client: { id: 'client-123', user_id: 'client-456' },
    agent: null,
  } as any;

  const mockOrder = {
    id: 'order-123',
    order_number: 'ORD-20241201-000001',
    current_status: 'pending',
    total_amount: 100.0,
    currency: 'USD',
    business: { user_id: 'user-123' },
    client_id: 'client-123',
    assigned_agent_id: null,
    assigned_agent: null,
  };

  const shippingInventoryFixture = () => ({
    id: 'inventory-123',
    computed_available_quantity: 10,
    selling_price: 25,
    is_active: true,
    business_location_id: 'location-123',
    item_variant_id: null,
    variant_price_overrides: [],
    item_variant: null,
    business_location: {
      business_id: 'business-123',
      is_active: true,
      operating_hours: null,
      mobile_payment_phone: { is_verified: true },
      address: { country: 'CA' },
      business: {
        id: 'business-123',
        can_accept_orders: true,
        user: { id: 'merchant-user-123' },
      },
    },
    item: shippingItemFixture(),
  });

  const shippingItemFixture = () => ({
    id: 'item-123',
    name: 'Shipping item',
    description: 'Ships to the customer',
    pay_on_delivery_enabled: false,
    pay_at_pickup_enabled: false,
    shipping_enabled: true,
    shipping_price: 5,
    shipping_currency: 'CAD',
    currency: 'CAD',
    weight: 1,
    max_order_quantity: null,
    stripe_tax_code_id: null,
    item_variants: [],
  });

  const mockReadyOrder = {
    ...mockOrder,
    current_status: 'ready_for_pickup',
  };

  const mockAgentAccount = {
    id: 'account-123',
    available_balance: 1000.0,
    withheld_balance: 0.0,
    total_balance: 1000.0,
  };

  beforeEach(async () => {
    const mockHasuraUserService = {
      getUser: jest.fn(),
      sessionPersonaContext: jest.fn().mockReturnValue({
        jwtDefaultRole: undefined,
        jwtAllowedRoles: [],
      }),
      getUserAddressById: jest.fn(),
      updateOrderStatus: jest.fn(),
      executeQuery: jest.fn(),
      executeMutation: jest.fn(),
    };

    const mockHasuraSystemService = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn(),
      getAccount: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const mockAgentHoldService = {
      getHoldPercentageForAgent: jest.fn().mockResolvedValue(80),
    };

    const mockAccountsService = {
      registerTransaction: jest.fn(),
    };

    const mockOrderStatusService = {
      updateOrderStatus: jest.fn(),
      creditReferralAfterCompletedDelivery: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: HasuraUserService,
          useValue: mockHasuraUserService,
        },
        {
          provide: HasuraSystemService,
          useValue: mockHasuraSystemService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: AgentHoldService,
          useValue: mockAgentHoldService,
        },
        {
          provide: AccountsService,
          useValue: mockAccountsService,
        },
        {
          provide: OrderStatusService,
          useValue: mockOrderStatusService,
        },
        { provide: GoogleDistanceService, useValue: {} },
        { provide: AddressesService, useValue: {} },
        { provide: MobilePaymentsService, useValue: { getProvider: jest.fn() } },
        { provide: MobilePaymentsDatabaseService, useValue: {
          hasPendingClaimOrderForOrderNumber: jest.fn().mockResolvedValue(false),
          getOrderNumbersWithPendingClaimOrder: jest.fn().mockResolvedValue([]),
        } },
        { provide: NotificationsService, useValue: {} },
        { provide: DeliveryConfigService, useValue: {} },
        { provide: DeliveryWindowsService, useValue: {} },
        { provide: CommissionsService, useValue: {
          getCommissionConfigs: jest.fn().mockResolvedValue({}),
          calculateAgentEarningsSync: jest.fn().mockReturnValue({ delivery_commission: 500 }),
        } },
        { provide: PdfService, useValue: {} },
        {
          provide: OrderQueueService,
          useValue: { sendOrderCreatedMessage: jest.fn() },
        },
        { provide: WaitAndExecuteScheduleService, useValue: {} },
        {
          provide: DeliveryPinService,
          useValue: {
            getPinForClient: jest.fn().mockResolvedValue('1234'),
            generatePin: jest.fn().mockReturnValue('1234'),
            hashPin: jest.fn().mockReturnValue('hash'),
            setPinForClient: jest.fn(),
          },
        },
        {
          provide: DeliveryPinShareService,
          useValue: {
            resolvePinForCompletion: jest.fn(),
            markPinConsumed: jest.fn(),
          },
        },
        {
          provide: OrderRefundsService,
          useValue: {
            legacyDirectFullRefund: jest.fn().mockRejectedValue(
              new HttpException(
                'Direct refunds via this endpoint are disabled. Clients should submit a refund request; admins should use POST /admin/refunds/force.',
                HttpStatus.GONE
              )
            ),
          },
        },
        { provide: LoyaltyService, useValue: {} },
        {
          provide: PaymentRoutingService,
          useValue: {
            resolveRailForBusiness: jest.fn(),
            resolveRailForUser: jest.fn(),
          },
        },
        { provide: StripeCheckoutService, useValue: {} },
        {
          provide: StripeCaptureService,
          useValue: {
            captureOrderPaymentIntent: jest.fn(),
            creditWalletForCapturedOrder: jest.fn(),
          },
        },
        {
          provide: StripeTaxCheckoutBuilderService,
          useValue: {
            isTaxEnabledForCountry: jest.fn().mockReturnValue(false),
            normalizeCountryCode: jest.fn((c: string) => c),
          },
        },
        { provide: StripeTaxCalculationService, useValue: {} },
        {
          provide: OrderOffersService,
          useValue: {
            handleOrderAssigned: jest.fn(),
            getOfferDetailsForAgent: jest.fn(),
            getPendingOfferForAgent: jest.fn(),
            getActiveOfferForAgent: jest.fn(),
            markOfferExpired: jest.fn(),
            cancelAllOffers: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: CancellationPolicyService, useValue: { getPolicy: jest.fn() } },
        {
          provide: LocationsService,
          useValue: { getLatestAgentLocation: jest.fn().mockResolvedValue(null) },
        },
        { provide: OrderSystemJobsService, useValue: {} },
        {
          provide: OrderPickupMonitorService,
          useValue: {
            startMonitoring: jest.fn(),
            clearMonitoring: jest.fn(),
            markRecovered: jest.fn(),
            requestExtension: jest.fn(),
            pausePickup: jest.fn(),
            resumePickup: jest.fn(),
          },
        },
        {
          provide: OrderReassignmentService,
          useValue: {
            reportIssueAndRelease: jest.fn(),
            reassignOrder: jest.fn(),
          },
        },
        {
          provide: OrderEventsService,
          useValue: {
            listForOrder: jest.fn().mockResolvedValue([]),
            recordEvent: jest.fn(),
          },
        },
        {
          provide: OrderAcceptanceService,
          useValue: {
            assertConfirmableAcceptance: jest.fn(),
            markAccepted: jest.fn(),
            startAcceptanceSla: jest.fn(),
            isBusinessAcceptingOrders: jest.fn().mockResolvedValue(true),
            isWithinOperatingHours: jest.fn().mockReturnValue(true),
            getBusinessTiming: jest.fn().mockResolvedValue({
              defaultEstimatedPrepMinutes: 30,
              asapTimeoutSeconds: 900,
              futureTimeoutSeconds: 1800,
              activationLeadMinutes: 30,
            }),
            isSlotWithinOperatingHours: jest.fn().mockReturnValue(true),
            fetchDeliverySlotTimes: jest.fn().mockResolvedValue({
              start_time: '12:00',
              end_time: '13:00',
            }),
            getAcceptanceTimeoutSeconds: jest.fn().mockResolvedValue(300),
            recordMerchantCancelOfPending: jest.fn(),
          },
        },
        {
          provide: FulfillmentPromiseService,
          useValue: {
            persistForOrder: jest.fn(),
            reanchorAsapAtReady: jest.fn(),
            evaluateAsap: jest.fn().mockReturnValue({
              available: true,
              estimatedPrepMinutes: 30,
              scheduleRequired: false,
            }),
            timezoneForCountry: jest.fn().mockResolvedValue('UTC'),
            closedStoreMessage: jest
              .fn()
              .mockReturnValue('This store is closed. Select a future date below.'),
            inferTiming: jest.fn().mockReturnValue('asap'),
          },
        },
        { provide: RbacService, useValue: {} },
        {
          provide: DeliveryAvailabilityService,
          useValue: {
            evaluate: jest.fn().mockResolvedValue({
              available: true,
              estimatedDeliveryMinutes: null,
              reason: null,
              ruleId: null,
            }),
          },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
        {
          provide: FoodOrdersService,
          useValue: {
            isCookedFoodOrder: jest.fn().mockResolvedValue(false),
          },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    hasuraUserService = module.get(HasuraUserService);
    hasuraSystemService = module.get(HasuraSystemService);
    configService = module.get(ConfigService);
    agentHoldService = module.get(AgentHoldService);
    accountsService = module.get(AccountsService);
    orderStatusService = module.get(OrderStatusService);
    stripeCaptureService = module.get(StripeCaptureService);
  });

  describe('createOrder', () => {
    it('passes first-order delivery promo defaults for shipping orders', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockClientUser);
      hasuraUserService.sessionPersonaContext.mockReturnValue({
        jwtDefaultRole: 'client',
        jwtAllowedRoles: ['client'],
      });
      hasuraUserService.getUserAddressById.mockResolvedValue({
        id: 'address-123',
        address_line_1: '123 Main St',
        city: 'Toronto',
        state: 'ON',
        postal_code: 'M5V 1A1',
        country: 'CA',
      } as any);
      hasuraSystemService.getAccount.mockResolvedValue({
        id: 'account-123',
        available_balance: 100,
      } as any);
      (service as any).paymentRoutingService.resolveRailForUser.mockResolvedValue(
        'mobile_money'
      );
      jest
        .spyOn(service as any, 'updateReservedQuantities')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'triggerCommerceInventoryCommit')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'requireOrderDetailsByNumber')
        .mockResolvedValue({ id: 'order-123', order_number: '12345678' });
      jest
        .spyOn(service as any, 'finalizeClientOrderPayment')
        .mockResolvedValue(undefined);

      hasuraSystemService.executeQuery
        .mockResolvedValueOnce({
          business_inventory: [shippingInventoryFixture()],
        })
        .mockResolvedValueOnce({ supported_payment_systems: [] })
        .mockResolvedValueOnce({ item_deals: [] });
      hasuraSystemService.executeMutation
        .mockResolvedValueOnce({
          insert_orders_one: {
            id: 'order-123',
            order_number: '12345678',
            payment_source: 'wallet',
          },
        })
        .mockResolvedValueOnce({ affected_rows: 1 });

      await service.createOrder({
        delivery_address_id: 'address-123',
        fulfillment_method: 'shipping',
        payment_timing: 'pay_now',
        phone_number: '+14165550123',
        items: [{ business_inventory_id: 'inventory-123', quantity: 1 }],
      });

      expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('mutation CreateOrderWithItems'),
        expect.objectContaining({
          baseDeliveryFee: 5,
          perKmDeliveryFee: 0,
          firstOrderDeliveryFeePromo: false,
          firstOrderBaseDeliveryDiscountAmount: 0,
        })
      );
    });
  });

  describe.skip('confirmOrder', () => {
    it('should confirm an order successfully', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: mockOrder,
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'confirmed',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.confirmOrder({
        orderId: 'order-123',
        notes: 'Confirmed by business',
      });

      expect(result.success).toBe(true);
      expect(result.order.current_status).toBe('confirmed');
      expect(orderStatusService.updateOrderStatus).toHaveBeenCalledWith(
        'order-123',
        'confirmed'
      );
    });

    it('should throw error if user is not a business', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);

      await expect(
        service.confirmOrder({ orderId: 'order-123' })
      ).rejects.toThrow(
        new HttpException(
          'Only business users can confirm orders',
          HttpStatus.FORBIDDEN
        )
      );
    });

    it('should throw error if order not found', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockUser);
      hasuraUserService.executeQuery.mockResolvedValue({ orders_by_pk: null });

      await expect(
        service.confirmOrder({ orderId: 'order-123' })
      ).rejects.toThrow(
        new HttpException('Order not found', HttpStatus.NOT_FOUND)
      );
    });

    it('should throw error if order is not in pending status', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: { ...mockOrder, current_status: 'confirmed' },
      });

      await expect(
        service.confirmOrder({ orderId: 'order-123' })
      ).rejects.toThrow(
        new HttpException(
          'Cannot confirm order in confirmed status',
          HttpStatus.BAD_REQUEST
        )
      );
    });
  });

  describe.skip('completePreparation', () => {
    it('should complete preparation successfully from confirmed status', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: { ...mockOrder, current_status: 'confirmed' },
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'ready_for_pickup',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.completePreparation({
        orderId: 'order-123',
        notes: 'Preparation completed',
      });

      expect(result.success).toBe(true);
      expect(result.order.current_status).toBe('ready_for_pickup');
    });

    it('should complete preparation successfully from preparing status', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: { ...mockOrder, current_status: 'preparing' },
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'ready_for_pickup',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.completePreparation({
        orderId: 'order-123',
        notes: 'Preparation completed',
      });

      expect(result.success).toBe(true);
      expect(result.order.current_status).toBe('ready_for_pickup');
    });
  });

  describe.skip('completePreparationBatch', () => {
    it('should complete preparation for multiple orders successfully', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: { ...mockOrder, current_status: 'preparing' },
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'ready_for_pickup',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.completePreparationBatch({
        orderIds: ['order-123', 'order-456'],
        notes: 'Batch complete preparation',
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results.every((r) => r.success)).toBe(true);
    });

    it('should return partial success when some orders fail', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockUser);
      hasuraUserService.executeQuery
        .mockResolvedValueOnce({
          orders_by_pk: { ...mockOrder, current_status: 'preparing' },
        })
        .mockResolvedValueOnce({
          orders_by_pk: { ...mockOrder, current_status: 'confirmed' },
        });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'ready_for_pickup',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.completePreparationBatch({
        orderIds: ['order-123', 'order-456'],
        notes: 'Batch complete preparation',
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results.filter((r) => r.success)).toHaveLength(1);
      expect(result.results.filter((r) => !r.success)).toHaveLength(1);
    });
  });

  describe.skip('getOrder', () => {
    beforeEach(() => {
      agentHoldService.getHoldPercentageForAgent.mockResolvedValue(80); // 80% hold percentage
    });

    it('should assign order to agent successfully', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: mockReadyOrder,
      });
      hasuraSystemService.executeQuery.mockResolvedValue({
        accounts: [mockAgentAccount],
      });
      hasuraSystemService.executeMutation.mockResolvedValue({
        affected_rows: 1,
      });
      hasuraUserService.executeMutation.mockResolvedValue({
        update_orders_by_pk: {
          ...mockReadyOrder,
          current_status: 'assigned_to_agent',
          assigned_agent_id: 'agent-123',
        },
      });

      const result = await service.getOrder({ orderId: 'order-123' });

      expect(result.success).toBe(true);
      expect(result.order.current_status).toBe('assigned_to_agent');
      expect(result.holdAmount).toBe(80.0); // 80% of 100
    });

    it('should throw error if user is not an agent', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockUser);

      await expect(service.getOrder({ orderId: 'order-123' })).rejects.toThrow(
        new HttpException(
          'Only agent users can get orders',
          HttpStatus.FORBIDDEN
        )
      );
    });

    it('should throw error if order is not ready for pickup', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: { ...mockOrder, current_status: 'pending' },
      });

      await expect(service.getOrder({ orderId: 'order-123' })).rejects.toThrow(
        new HttpException(
          'Cannot get order in pending status',
          HttpStatus.BAD_REQUEST
        )
      );
    });

    it('should throw error if agent has insufficient balance', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: mockReadyOrder,
      });
      hasuraSystemService.executeQuery.mockResolvedValue({
        accounts: [{ ...mockAgentAccount, available_balance: 50.0 }],
      });

      await expect(service.getOrder({ orderId: 'order-123' })).rejects.toThrow(
        new HttpException(
          'Insufficient balance. Required: 80 USD, Available: 50 USD',
          HttpStatus.FORBIDDEN
        )
      );
    });

    it('should throw error if agent has no account for currency', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: mockReadyOrder,
      });
      hasuraSystemService.executeQuery.mockResolvedValue({
        accounts: [],
      });

      await expect(service.getOrder({ orderId: 'order-123' })).rejects.toThrow(
        new HttpException(
          'No account found for currency USD',
          HttpStatus.BAD_REQUEST
        )
      );
    });
  });

  describe.skip('pickUpOrder', () => {
    const assignedOrder = {
      ...mockOrder,
      current_status: 'assigned_to_agent',
      assigned_agent_id: 'agent-123',
      payment_timing: 'pay_at_delivery',
      payment_status: 'pending',
      subtotal: 80,
      base_delivery_fee: 5,
      per_km_delivery_fee: 0,
      business: { user_id: 'user-123', id: 'business-123' },
      client: { user_id: 'client-456', id: 'client-123' },
      order_items: [],
    };

    it('should pick up order successfully', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraSystemService.executeQuery.mockResolvedValue({
        orders_by_pk: assignedOrder,
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...assignedOrder,
        current_status: 'picked_up',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.pickUpOrder({
        orderId: 'order-123',
        notes: 'Picked up from business location',
      });

      expect(result.success).toBe(true);
      expect(result.order.current_status).toBe('picked_up');
      expect(stripeCaptureService.captureOrderPaymentIntent).not.toHaveBeenCalled();
    });

    it('captures authorized Stripe payment at pickup', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraSystemService.executeQuery.mockResolvedValue({
        orders_by_pk: {
          ...assignedOrder,
          payment_timing: 'pay_now',
          payment_source: 'credit_card',
          payment_status: 'authorized',
        },
      });
      hasuraSystemService.executeMutation.mockResolvedValue({
        order_holds: [{ id: 'hold-1', item_settlement_completed_at: '2024-01-02' }],
      });
      stripeCaptureService.captureOrderPaymentIntent.mockResolvedValue({
        success: true,
        captured: true,
      });
      const finalizeSpy = jest
        .spyOn(service as any, 'finalizeStripeCapturedOrderPayment')
        .mockResolvedValue(undefined);
      const processSpy = jest
        .spyOn(service, 'processOrderPayment')
        .mockResolvedValue(undefined);
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...assignedOrder,
        current_status: 'picked_up',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      await service.pickUpOrder({ orderId: 'order-123' });

      expect(stripeCaptureService.captureOrderPaymentIntent).toHaveBeenCalledWith({
        orderId: 'order-123',
        orderNumber: assignedOrder.order_number,
      });
      expect(finalizeSpy).toHaveBeenCalledWith(assignedOrder.order_number);
      expect(processSpy).toHaveBeenCalledWith('order-123');
      finalizeSpy.mockRestore();
      processSpy.mockRestore();
    });

    it('does not capture Stripe when order was already paid from wallet', async () => {
      await (service as any).captureStripeAuthorizedOrderIfNeeded({
        id: 'order-123',
        order_number: assignedOrder.order_number,
        payment_timing: 'pay_now',
        payment_source: 'wallet',
        payment_status: 'paid',
        fulfillment_method: 'pickup',
      });

      expect(stripeCaptureService.captureOrderPaymentIntent).not.toHaveBeenCalled();
    });

    it('does not capture Stripe when payment_status is already paid', async () => {
      await (service as any).captureStripeAuthorizedOrderIfNeeded({
        id: 'order-123',
        order_number: assignedOrder.order_number,
        payment_timing: 'pay_now',
        payment_source: 'credit_card',
        payment_status: 'paid',
        fulfillment_method: 'pickup',
      });

      expect(stripeCaptureService.captureOrderPaymentIntent).not.toHaveBeenCalled();
    });

    it('should throw error if user is not an agent', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockUser);

      await expect(
        service.pickUpOrder({ orderId: 'order-123' })
      ).rejects.toThrow(
        new HttpException(
          'Only agent users can pick up orders',
          HttpStatus.FORBIDDEN
        )
      );
    });

    it('should throw error if order is not assigned to agent', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraSystemService.executeQuery.mockResolvedValue({
        orders_by_pk: {
          ...assignedOrder,
          assigned_agent_id: 'different-agent',
        },
      });

      await expect(
        service.pickUpOrder({ orderId: 'order-123' })
      ).rejects.toThrow(
        new HttpException(
          'Only the assigned agent can pick up this order',
          HttpStatus.FORBIDDEN
        )
      );
    });
  });

  describe.skip('pickUpOrderBatch', () => {
    it('should pick up multiple orders successfully', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: {
          ...mockOrder,
          current_status: 'assigned_to_agent',
          assigned_agent_id: 'agent-123',
        },
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'picked_up',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.pickUpOrderBatch({
        orderIds: ['order-123', 'order-456'],
        notes: 'Batch pick up',
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results.every((r) => r.success)).toBe(true);
    });

    it('should return partial success when some orders fail', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraUserService.executeQuery
        .mockResolvedValueOnce({
          orders_by_pk: {
            ...mockOrder,
            current_status: 'assigned_to_agent',
            assigned_agent_id: 'agent-123',
          },
        })
        .mockResolvedValueOnce({
          orders_by_pk: {
            ...mockOrder,
            current_status: 'assigned_to_agent',
            assigned_agent_id: 'different-agent',
          },
        });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'picked_up',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.pickUpOrderBatch({
        orderIds: ['order-123', 'order-456'],
        notes: 'Batch pick up',
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results.filter((r) => r.success)).toHaveLength(1);
      expect(result.results.filter((r) => !r.success)).toHaveLength(1);
    });
  });

  describe.skip('startTransit', () => {
    it('should start transit successfully', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: {
          ...mockOrder,
          current_status: 'picked_up',
          assigned_agent_id: 'agent-123',
        },
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'in_transit',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.startTransit({
        orderId: 'order-123',
        notes: 'Started transit to customer',
      });

      expect(result.success).toBe(true);
      expect(result.order.current_status).toBe('in_transit');
    });
  });

  describe.skip('startTransitBatch', () => {
    it('should start transit for multiple orders successfully', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: {
          ...mockOrder,
          current_status: 'picked_up',
          assigned_agent_id: 'agent-123',
        },
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'in_transit',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.startTransitBatch({
        orderIds: ['order-123', 'order-456'],
        notes: 'Batch start transit',
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results.every((r) => r.success)).toBe(true);
    });
  });

  describe.skip('outForDelivery', () => {
    it('should mark as out for delivery successfully', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: {
          ...mockOrder,
          current_status: 'in_transit',
          assigned_agent_id: 'agent-123',
        },
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'out_for_delivery',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.outForDelivery({
        orderId: 'order-123',
        notes: 'Arrived at customer location',
      });

      expect(result.success).toBe(true);
      expect(result.order.current_status).toBe('out_for_delivery');
    });
  });

  describe.skip('outForDeliveryBatch', () => {
    it('should mark multiple orders as out for delivery successfully', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: {
          ...mockOrder,
          current_status: 'in_transit',
          assigned_agent_id: 'agent-123',
        },
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'out_for_delivery',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.outForDeliveryBatch({
        orderIds: ['order-123', 'order-456'],
        notes: 'Batch out for delivery',
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results.every((r) => r.success)).toBe(true);
    });
  });

  describe.skip('deliverOrder', () => {
    it('should deliver order successfully', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: {
          ...mockOrder,
          current_status: 'out_for_delivery',
          assigned_agent_id: 'agent-123',
        },
      });
      hasuraSystemService.executeQuery.mockResolvedValue({
        accounts: [mockAgentAccount],
      });
      hasuraSystemService.executeMutation.mockResolvedValue({
        affected_rows: 1,
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'delivered',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.deliverOrder({
        orderId: 'order-123',
        notes: 'Delivered to customer',
      });

      expect(result.success).toBe(true);
      expect(result.order.current_status).toBe('delivered');
    });
  });

  describe.skip('deliverOrderBatch', () => {
    it('should deliver multiple orders successfully', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: {
          ...mockOrder,
          current_status: 'out_for_delivery',
          assigned_agent_id: 'agent-123',
        },
      });
      hasuraSystemService.executeQuery.mockResolvedValue({
        accounts: [mockAgentAccount],
      });
      hasuraSystemService.executeMutation.mockResolvedValue({
        affected_rows: 1,
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'delivered',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.deliverOrderBatch({
        orderIds: ['order-123', 'order-456'],
        notes: 'Batch deliver',
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results.every((r) => r.success)).toBe(true);
    });
  });

  describe.skip('failDelivery', () => {
    it('should mark delivery as failed successfully', async () => {
      const mockFailedOrder = {
        ...mockOrder,
        current_status: 'out_for_delivery',
        assigned_agent_id: 'agent-123',
        assigned_agent: { user_id: 'agent-123' },
        client: { user_id: 'client-456' },
      };

      const mockOrderHold = {
        id: 'hold-123',
        client_hold_amount: 100.0,
        agent_hold_amount: 80.0,
      };

      hasuraUserService.getUser.mockResolvedValue(mockAgentUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: mockFailedOrder,
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockFailedOrder,
        current_status: 'failed',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      // Mock the getOrCreateOrderHold method
      jest
        .spyOn(service as any, 'getOrCreateOrderHold')
        .mockResolvedValue(mockOrderHold);

      // Mock hasuraSystemService.getAccount for both agent and client
      hasuraSystemService.getAccount
        .mockResolvedValueOnce({
          id: 'agent-account-123',
          available_balance: 1000.0,
        })
        .mockResolvedValueOnce({
          id: 'client-account-123',
          available_balance: 1000.0,
        });

      const result = await service.failDelivery({
        orderId: 'order-123',
        notes: 'Customer not available',
      });

      expect(result.success).toBe(true);
      expect(result.order.current_status).toBe('failed');

      // Verify that both agent and client hold release transactions were registered
      expect(accountsService.registerTransaction).toHaveBeenCalledWith({
        accountId: 'agent-account-123',
        amount: 80.0,
        transactionType: 'release',
        memo: 'Hold released for order ORD-20241201-000001',
        referenceId: 'order-123',
      });

      expect(accountsService.registerTransaction).toHaveBeenCalledWith({
        accountId: 'client-account-123',
        amount: 100.0,
        transactionType: 'release',
        memo: 'Hold released for order ORD-20241201-000001',
        referenceId: 'order-123',
      });
    });
  });

  describe.skip('cancelOrder', () => {
    it('should cancel order successfully', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: { ...mockOrder, current_status: 'pending' },
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'cancelled',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.cancelOrder({
        orderId: 'order-123',
        notes: 'Cancelled by business',
      });

      expect(result.success).toBe(true);
      expect(result.order.current_status).toBe('cancelled');
    });

    it('should throw error if order cannot be cancelled', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: { ...mockOrder, current_status: 'delivered' },
      });

      await expect(
        service.cancelOrder({ orderId: 'order-123' })
      ).rejects.toThrow(
        new HttpException(
          'Cannot cancel order in delivered status',
          HttpStatus.BAD_REQUEST
        )
      );
    });

    it('should allow business to cancel deferred uncollected order after handoff', async () => {
      const deferredOrder = {
        ...mockOrder,
        current_status: 'out_for_delivery',
        payment_status: 'pending',
        payment_timing: 'pay_at_delivery',
        assigned_agent_id: 'agent-123',
      };

      hasuraUserService.getUser.mockResolvedValue(mockUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: deferredOrder,
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...deferredOrder,
        current_status: 'cancelled',
      });

      const result = await service.cancelOrder({
        orderId: 'order-123',
        notes: 'Customer did not pay at delivery',
      });

      expect(result.success).toBe(true);
      expect(orderStatusService.updateOrderStatus).toHaveBeenCalledWith(
        'order-123',
        'cancelled'
      );
      expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: 'cancelled',
          changedByType: 'business',
        })
      );
    });

    it('should not allow business to cancel late orders after payment collection', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: {
          ...mockOrder,
          current_status: 'out_for_delivery',
          payment_status: 'paid',
          payment_timing: 'pay_at_delivery',
        },
      });

      await expect(
        service.cancelOrder({ orderId: 'order-123' })
      ).rejects.toThrow(
        new HttpException(
          'Cannot cancel order in out_for_delivery status. Orders can only be cancelled before pickup by delivery agent.',
          HttpStatus.BAD_REQUEST
        )
      );
      expect(orderStatusService.updateOrderStatus).not.toHaveBeenCalled();
    });

    it('should allow client to cancel their own order in pending status', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockClientUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: { ...mockOrder, current_status: 'pending' },
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'cancelled',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.cancelOrder({
        orderId: 'order-123',
        notes: 'Cancelled by client',
      });

      expect(result.success).toBe(true);
      expect(result.order.current_status).toBe('cancelled');
    });

    it('should release client hold when order is cancelled', async () => {
      const mockOrderWithHold = {
        ...mockOrder,
        current_status: 'pending',
        client: { user_id: 'client-456' },
        assigned_agent: null,
      };

      const mockOrderHold = {
        id: 'hold-123',
        client_hold_amount: 100.0,
        agent_hold_amount: 0,
      };

      hasuraUserService.getUser.mockResolvedValue(mockClientUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: mockOrderWithHold,
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrderWithHold,
        current_status: 'cancelled',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      // Mock the getOrCreateOrderHold method
      jest
        .spyOn(service as any, 'getOrCreateOrderHold')
        .mockResolvedValue(mockOrderHold);

      // Mock hasuraSystemService.getAccount for client
      hasuraSystemService.getAccount.mockResolvedValue({
        id: 'client-account-123',
        available_balance: 1000.0,
      });

      const result = await service.cancelOrder({
        orderId: 'order-123',
        notes: 'Cancelled by client',
      });

      expect(result.success).toBe(true);
      expect(result.order.current_status).toBe('cancelled');

      // Verify that client hold release transaction was registered
      expect(accountsService.registerTransaction).toHaveBeenCalledWith({
        accountId: 'client-account-123',
        amount: 100.0,
        transactionType: 'release',
        memo: 'Hold released for order ORD-20241201-000001',
        referenceId: 'order-123',
      });
    });

    it('should release both agent and client holds when assigned order is cancelled', async () => {
      const mockOrderWithAgentAndHold = {
        ...mockOrder,
        current_status: 'assigned_to_agent',
        client: { user_id: 'client-456' },
        assigned_agent: { user_id: 'agent-123' },
        assigned_agent_id: 'agent-123',
      };

      const mockOrderHold = {
        id: 'hold-123',
        client_hold_amount: 100.0,
        agent_hold_amount: 80.0,
      };

      hasuraUserService.getUser.mockResolvedValue(mockUser); // Business user cancelling
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: mockOrderWithAgentAndHold,
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrderWithAgentAndHold,
        current_status: 'cancelled',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      // Mock the getOrCreateOrderHold method
      jest
        .spyOn(service as any, 'getOrCreateOrderHold')
        .mockResolvedValue(mockOrderHold);

      // Mock hasuraSystemService.getAccount for both agent and client
      hasuraSystemService.getAccount
        .mockResolvedValueOnce({
          id: 'agent-account-123',
          available_balance: 1000.0,
        })
        .mockResolvedValueOnce({
          id: 'client-account-123',
          available_balance: 1000.0,
        });

      const result = await service.cancelOrder({
        orderId: 'order-123',
        notes: 'Cancelled by business',
      });

      expect(result.success).toBe(true);
      expect(result.order.current_status).toBe('cancelled');

      // Verify that agent hold release transaction was registered
      expect(accountsService.registerTransaction).toHaveBeenCalledWith({
        accountId: 'agent-account-123',
        amount: 80.0,
        transactionType: 'release',
        memo: 'Hold released for order ORD-20241201-000001',
        referenceId: 'order-123',
      });

      // Verify that client hold release transaction was registered
      expect(accountsService.registerTransaction).toHaveBeenCalledWith({
        accountId: 'client-account-123',
        amount: 100.0,
        transactionType: 'release',
        memo: 'Hold released for order ORD-20241201-000001',
        referenceId: 'order-123',
      });
    });

    it('should allow client to cancel their own order in confirmed status', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockClientUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: { ...mockOrder, current_status: 'confirmed' },
      });
      orderStatusService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        current_status: 'cancelled',
      });
      hasuraUserService.executeMutation.mockResolvedValue({ affected_rows: 1 });

      const result = await service.cancelOrder({
        orderId: 'order-123',
        notes: 'Changed my mind',
      });

      expect(result.success).toBe(true);
      expect(result.order.current_status).toBe('cancelled');
    });

    it('should not allow client to cancel order in preparing status', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockClientUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: { ...mockOrder, current_status: 'preparing' },
      });

      await expect(
        service.cancelOrder({ orderId: 'order-123' })
      ).rejects.toThrow(
        new HttpException(
          'Cannot cancel order in preparing status',
          HttpStatus.BAD_REQUEST
        )
      );
    });

    it('should not allow client to cancel order that does not belong to them', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockClientUser);
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: {
          ...mockOrder,
          client_id: 'different-client',
          current_status: 'pending',
        },
      });

      await expect(
        service.cancelOrder({ orderId: 'order-123' })
      ).rejects.toThrow(
        new HttpException(
          'Unauthorized to cancel this order',
          HttpStatus.FORBIDDEN
        )
      );
    });

    it('should not allow non-business and non-client users to cancel orders', async () => {
      const mockInvalidUser = {
        ...mockUser,
        business: null,
        client: null,
      };
      hasuraUserService.getUser.mockResolvedValue(mockInvalidUser);

      await expect(
        service.cancelOrder({ orderId: 'order-123' })
      ).rejects.toThrow(
        new HttpException(
          'Only business users and clients can cancel orders',
          HttpStatus.FORBIDDEN
        )
      );
    });
  });

  describe('refundOrder', () => {
    it('should reject deprecated direct refund endpoint', async () => {
      await expect(
        service.refundOrder({
          orderId: 'order-123',
          notes: 'Refunded due to customer complaint',
        })
      ).rejects.toThrow(
        new HttpException(
          'Direct refunds via this endpoint are disabled. Clients should submit a refund request; admins should use POST /admin/refunds/force.',
          HttpStatus.GONE
        )
      );
    });
  });

  describe.skip('helper methods', () => {
    it('should aggregate duplicate inventory lines when updating reservations', async () => {
      hasuraSystemService.executeQuery
        .mockResolvedValueOnce({
          business_inventory: [
            { id: 'inventory-123', reserved_quantity: 2, quantity: 10 },
          ],
        })
        .mockResolvedValueOnce({
          update_business_inventory_by_pk: {
            id: 'inventory-123',
            reserved_quantity: 7,
            quantity: 10,
          },
        });

      await service.updateReservedQuantities(
        [
          { business_inventory_id: 'inventory-123', quantity: 3 },
          { business_inventory_id: 'inventory-123', quantity: 2 },
        ],
        'increment'
      );

      expect(hasuraSystemService.executeQuery).toHaveBeenCalledTimes(2);
      expect(hasuraSystemService.executeQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('mutation UpdateReservedQuantity'),
        { id: 'inventory-123', reservedQuantity: 7 }
      );
    });

    it('should get order details correctly', async () => {
      hasuraUserService.executeQuery.mockResolvedValue({
        orders_by_pk: mockOrder,
      });

      const result = await (service as any).getOrderDetails('order-123');

      expect(result).toEqual(mockOrder);
      expect(hasuraUserService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('query GetOrder'),
        { orderId: 'order-123' }
      );
    });

    it('should place hold on account correctly', async () => {
      hasuraSystemService.executeMutation.mockResolvedValue({
        affected_rows: 1,
      });

      await (service as any).placeHoldOnAccount(
        'account-123',
        80.0,
        'Hold for order ORD-123',
        'order-123'
      );

      expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('mutation PlaceHold'),
        {
          accountId: 'account-123',
          amount: 80.0,
          memo: 'Hold for order ORD-123',
          referenceId: 'order-123',
        }
      );
    });
  });

  describe('order settlement numerics', () => {
    it('updateOrderHold coerces NaN delivery_fees to 0 for GraphQL numeric', async () => {
      hasuraSystemService.executeMutation.mockResolvedValue({
        update_order_holds_by_pk: { id: 'hold-1' },
      });

      await service.updateOrderHold('hold-1', { delivery_fees: Number.NaN });

      expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('mutation UpdateOrderHold'),
        {
          orderHoldId: 'hold-1',
          _set: { delivery_fees: 0 },
        }
      );
    });

    it('finalizeClientOrderPayment coerces stripped subtotal and fees to 0', async () => {
      const updateOrderHoldSpy = jest
        .spyOn(service, 'updateOrderHold')
        .mockResolvedValue({ id: 'hold-1' });
      jest.spyOn(service, 'getOrCreateOrderHold').mockResolvedValue({
        id: 'hold-1',
      } as any);
      jest
        .spyOn(service as any, 'updateOrderStatusAndPaymentStatus')
        .mockResolvedValue(undefined);
      hasuraSystemService.executeMutation.mockResolvedValue({});

      await (service as any).finalizeClientOrderPayment(
        {
          id: 'order-123',
          order_number: 'ORD-1',
          payment_status: 'authorized',
        },
        'account-1'
      );

      expect(accountsService.registerTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 0, transactionType: 'hold' })
      );
      expect(updateOrderHoldSpy).toHaveBeenCalledWith('hold-1', {
        client_hold_amount: 0,
        delivery_fees: 0,
      });

      updateOrderHoldSpy.mockRestore();
    });

    it('finalizeClientOrderPayment does not regress assigned_to_agent to pending', async () => {
      const updateOrderHoldSpy = jest
        .spyOn(service, 'updateOrderHold')
        .mockResolvedValue({ id: 'hold-1' });
      jest.spyOn(service, 'getOrCreateOrderHold').mockResolvedValue({
        id: 'hold-1',
      } as any);
      const statusAndPaymentSpy = jest
        .spyOn(service as any, 'updateOrderStatusAndPaymentStatus')
        .mockResolvedValue(undefined);
      const paymentOnlySpy = jest
        .spyOn(service as any, 'updateOrderPaymentStatusOnly')
        .mockResolvedValue(undefined);
      hasuraSystemService.executeMutation.mockResolvedValue({});

      await (service as any).finalizeClientOrderPayment(
        {
          id: 'order-123',
          order_number: 'ORD-1',
          current_status: 'assigned_to_agent',
          payment_status: 'authorized',
          subtotal: 40,
          base_delivery_fee: 5,
          per_km_delivery_fee: 0,
        },
        'account-1'
      );

      expect(statusAndPaymentSpy).not.toHaveBeenCalled();
      expect(paymentOnlySpy).toHaveBeenCalledWith('order-123', 'paid');

      statusAndPaymentSpy.mockRestore();
      paymentOnlySpy.mockRestore();
      updateOrderHoldSpy.mockRestore();
    });

    it('finalizeOrderAfterIncomingPayment loads order without agent API transform', async () => {
      const rawOrder = {
        id: 'order-123',
        order_number: 'ORD-1',
        payment_timing: 'pay_now',
        payment_status: 'pending',
        subtotal: 50,
        base_delivery_fee: 3,
        per_km_delivery_fee: 2,
      };
      const requireSpy = jest
        .spyOn(service as any, 'requireOrderDetailsByNumber')
        .mockResolvedValue(rawOrder);
      const getByNumberSpy = jest.spyOn(service, 'getOrderByNumber');
      const finalizeSpy = jest
        .spyOn(service as any, 'finalizeClientOrderPayment')
        .mockResolvedValue(undefined);

      await service.finalizeOrderAfterIncomingPayment({
        entity_id: 'ORD-1',
        account_id: 'account-1',
      });

      expect(requireSpy).toHaveBeenCalledWith('ORD-1');
      expect(getByNumberSpy).not.toHaveBeenCalled();
      expect(finalizeSpy).toHaveBeenCalledWith(rawOrder, 'account-1');

      requireSpy.mockRestore();
      getByNumberSpy.mockRestore();
      finalizeSpy.mockRestore();
    });
  });

  describe('getOpenOrders', () => {
    const previewAgentUser = {
      ...mockAgentUser,
      agent: { id: 'agent-123', user_id: 'agent-123', is_verified: false },
    };

    const openOrderRow = {
      order_number: 'ORD-1',
      business_location: {
        address: { country: 'CM', state: 'Littoral' },
      },
      subtotal: 1000,
      base_delivery_fee: 100,
      per_km_delivery_fee: 10,
      currency: 'XAF',
      current_status: 'ready_for_pickup',
      order_items: [],
    };

    beforeEach(() => {
      hasuraUserService.sessionPersonaContext.mockReturnValue({
        jwtDefaultRole: 'agent',
        jwtAllowedRoles: ['agent'],
      });
      hasuraSystemService.getAllUserAddresses = jest
        .fn()
        .mockResolvedValue([
          { country: 'CM', state: '', is_primary: true },
        ]);
      hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
        if (query.includes('GetAgentStatus')) {
          return { agents_by_pk: { status: 'active' } };
        }
        if (query.includes('OpenOrders')) {
          return { orders: [openOrderRow] };
        }
        return {};
      });
    });

    it('returns country preview with canClaim false for unverified agents', async () => {
      hasuraUserService.getUser.mockResolvedValue(previewAgentUser);

      const result = await service.getOpenOrders();

      expect(result.canClaim).toBe(false);
      expect(result.previewMode).toBe('country');
      expect(result.orders).toHaveLength(1);
    });

    it('returns country listing with canClaim true for verified agents without state', async () => {
      hasuraUserService.getUser.mockResolvedValue({
        ...mockAgentUser,
        agent: { id: 'agent-123', user_id: 'agent-123', is_verified: true },
      });
      hasuraSystemService.getAllUserAddresses = jest.fn().mockResolvedValue([
        { country: 'CM', state: '', is_primary: true },
      ]);
      (service as any).locationsService = {
        getLatestAgentLocation: jest.fn().mockResolvedValue({
          agentId: 'agent-123',
          latitude: 3.8,
          longitude: 11.5,
          updatedAt: new Date().toISOString(),
        }),
      };
      (service as any).googleDistanceService = {
        reverseGeocode: jest.fn().mockResolvedValue({
          country: 'CM',
          state: '',
        }),
      };

      const result = await service.getOpenOrders();

      expect(result.canClaim).toBe(true);
      expect(result.previewMode).toBe('country');
      expect(result.orders).toHaveLength(1);
    });

    it('returns empty orders for suspended agents', async () => {
      hasuraUserService.getUser.mockResolvedValue(previewAgentUser);
      hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
        if (query.includes('GetAgentStatus')) {
          return { agents_by_pk: { status: 'suspended' } };
        }
        return { orders: [openOrderRow] };
      });

      const result = await service.getOpenOrders();

      expect(result.orders).toHaveLength(0);
      expect(result.canClaim).toBe(false);
    });
  });

  describe('claimOrder verification', () => {
    it('rejects unverified agents with AGENT_NOT_VERIFIED', async () => {
      hasuraUserService.getUser.mockResolvedValue({
        ...mockAgentUser,
        agent: { id: 'agent-123', user_id: 'agent-123', is_verified: false },
      });
      hasuraUserService.sessionPersonaContext.mockReturnValue({
        jwtDefaultRole: 'agent',
        jwtAllowedRoles: ['agent'],
      });

      await expect(
        service.claimOrder({ orderId: 'order-123' })
      ).rejects.toMatchObject({
        response: {
          error: 'AGENT_NOT_VERIFIED',
        },
        status: HttpStatus.FORBIDDEN,
      });
    });
  });

  describe('switchToPickup', () => {
    const switchOrder = {
      ...mockOrder,
      current_status: 'ready_for_pickup',
      fulfillment_method: 'delivery',
      payment_status: 'paid',
      payment_source: 'wallet',
      payment_timing: 'pay_now',
      base_delivery_fee: 10,
      per_km_delivery_fee: 5,
      total_amount: 55,
      subtotal: 40,
      dispatch_exhausted_at: '2026-08-01T12:00:00Z',
      assigned_agent_id: null,
      client: { user_id: 'client-456', id: 'client-123' },
    };

    it('releases prepaid delivery hold and zeros hold delivery_fees', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockClientUser);
      hasuraUserService.sessionPersonaContext.mockReturnValue({
        jwtDefaultRole: 'client',
        jwtAllowedRoles: ['client'],
      });
      accountsService.registerTransaction.mockResolvedValue({ success: true });
      hasuraSystemService.getAccount.mockResolvedValue({ id: 'acct-client' });
      hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
        if (query.includes('GetOrder') || query.includes('orders_by_pk')) {
          return { orders_by_pk: switchOrder };
        }
        if (query.includes('OrderItemsPickupEligibility')) {
          return {
            order_items: [
              { business_inventory: { item: { pay_at_pickup_enabled: true } } },
            ],
          };
        }
        if (query.includes('FindOrderHold') || query.includes('order_holds')) {
          return {
            order_holds: [{ id: 'hold-1', delivery_fees: 15, client_hold_amount: 40 }],
          };
        }
        return {};
      });
      hasuraSystemService.executeMutation.mockImplementation(async (mutation: string) => {
        if (mutation.includes('SwitchToPickup')) {
          return { update_orders: { affected_rows: 1 } };
        }
        if (mutation.includes('UpdateOrderHold') || mutation.includes('order_holds')) {
          return { update_order_holds_by_pk: { id: 'hold-1', delivery_fees: 0 } };
        }
        return {};
      });

      const result = await service.switchToPickup('order-123');

      expect(result.success).toBe(true);
      expect(accountsService.registerTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'acct-client',
          amount: 15,
          transactionType: 'release',
          referenceId: 'order-123',
        })
      );
      expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('SwitchToPickup'),
        expect.objectContaining({ id: 'order-123', total: 40 })
      );
      const switchCallIndex = hasuraSystemService.executeMutation.mock.calls.findIndex(
        ([mutation]) => String(mutation).includes('SwitchToPickup')
      );
      expect(
        hasuraSystemService.executeMutation.mock.invocationCallOrder[
          switchCallIndex
        ]
      ).toBeLessThan(accountsService.registerTransaction.mock.invocationCallOrder[0]);
    });

    it('does not release a hold for authorized card orders without prepaid holds', async () => {
      const authorizedOrder = {
        ...switchOrder,
        payment_status: 'authorized',
        payment_source: 'credit_card',
      };
      hasuraUserService.getUser.mockResolvedValue(mockClientUser);
      hasuraUserService.sessionPersonaContext.mockReturnValue({
        jwtDefaultRole: 'client',
        jwtAllowedRoles: ['client'],
      });
      hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
        if (query.includes('GetOrder') || query.includes('orders_by_pk')) {
          return { orders_by_pk: authorizedOrder };
        }
        if (query.includes('OrderItemsPickupEligibility')) {
          return {
            order_items: [
              { business_inventory: { item: { pay_at_pickup_enabled: true } } },
            ],
          };
        }
        if (query.includes('FindOrderHold') || query.includes('order_holds')) {
          return { order_holds: [] };
        }
        return {};
      });
      hasuraSystemService.executeMutation.mockResolvedValue({
        update_orders: { affected_rows: 1 },
      });

      await service.switchToPickup('order-123');

      expect(accountsService.registerTransaction).not.toHaveBeenCalled();
    });

    it('rolls back the pickup claim when wallet release fails', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockClientUser);
      hasuraUserService.sessionPersonaContext.mockReturnValue({
        jwtDefaultRole: 'client',
        jwtAllowedRoles: ['client'],
      });
      accountsService.registerTransaction.mockResolvedValue({
        success: false,
        error: 'Insufficient withheld funds',
      });
      hasuraSystemService.getAccount.mockResolvedValue({ id: 'acct-client' });
      hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
        if (query.includes('GetOrder') || query.includes('orders_by_pk')) {
          return { orders_by_pk: switchOrder };
        }
        if (query.includes('OrderItemsPickupEligibility')) {
          return {
            order_items: [
              { business_inventory: { item: { pay_at_pickup_enabled: true } } },
            ],
          };
        }
        if (query.includes('FindOrderHold') || query.includes('order_holds')) {
          return {
            order_holds: [{ id: 'hold-1', delivery_fees: 15, client_hold_amount: 40 }],
          };
        }
        return {};
      });
      hasuraSystemService.executeMutation.mockImplementation(async (mutation: string) => {
        if (mutation.includes('SwitchToPickup')) {
          return { update_orders: { affected_rows: 1 } };
        }
        if (mutation.includes('RevertSwitchToPickup')) {
          return { update_orders_by_pk: { id: 'order-123' } };
        }
        if (mutation.includes('UpdateOrderHold') || mutation.includes('order_holds')) {
          return { update_order_holds_by_pk: { id: 'hold-1' } };
        }
        return {};
      });

      await expect(service.switchToPickup('order-123')).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
      });
      expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('RevertSwitchToPickup'),
        expect.objectContaining({
          id: 'order-123',
          fulfillmentMethod: 'delivery',
          total: 55,
        })
      );
    });

    it('conflicts when another actor already claimed the pickup switch', async () => {
      hasuraUserService.getUser.mockResolvedValue(mockClientUser);
      hasuraUserService.sessionPersonaContext.mockReturnValue({
        jwtDefaultRole: 'client',
        jwtAllowedRoles: ['client'],
      });
      hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
        if (query.includes('GetOrder') || query.includes('orders_by_pk')) {
          return { orders_by_pk: switchOrder };
        }
        if (query.includes('OrderItemsPickupEligibility')) {
          return {
            order_items: [
              { business_inventory: { item: { pay_at_pickup_enabled: true } } },
            ],
          };
        }
        if (query.includes('FindOrderHold') || query.includes('order_holds')) {
          return { order_holds: [] };
        }
        return {};
      });
      hasuraSystemService.executeMutation.mockResolvedValue({
        update_orders: { affected_rows: 0 },
      });

      await expect(service.switchToPickup('order-123')).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
      });
      expect(accountsService.registerTransaction).not.toHaveBeenCalled();
    });
  });

  describe('calculateItemDeliveryFee', () => {
    const itemId = '6c5c123d-f89d-46cb-8d4d-f43ca5e384bd';
    const itemDetails = {
      id: itemId,
      computed_available_quantity: 5,
      selling_price: 10,
      item: { id: 'catalog-1', name: 'Item', currency: 'XAF' },
      business_location: { address_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    };

    function stubItemQueries() {
      hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
        if (query.includes('ClientHasOrders')) {
          return { orders_aggregate: { aggregate: { count: 1 } } };
        }
        if (query.includes('GetItem')) {
          return { business_inventory_by_pk: itemDetails };
        }
        return {};
      });
    }

    it('returns 404 when the client has no address instead of querying Hasura with ""', async () => {
      const getAddressesByIds = jest.fn();
      (service as any).addressesService = { getAddressesByIds };
      hasuraUserService.getUser.mockResolvedValue({
        ...mockClientUser,
        addresses: [],
      });
      stubItemQueries();

      await expect(service.calculateItemDeliveryFee(itemId)).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        message: 'User address not found',
      });
      expect(getAddressesByIds).not.toHaveBeenCalled();
    });

    it('treats a blank addressId query as missing and still 404s without a fallback address', async () => {
      const getAddressesByIds = jest.fn();
      (service as any).addressesService = { getAddressesByIds };
      hasuraUserService.getUser.mockResolvedValue({
        ...mockClientUser,
        addresses: [{ id: '', status: 'active', is_primary: true }],
      });
      stubItemQueries();

      await expect(
        service.calculateItemDeliveryFee(itemId, '   ')
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        message: 'User address not found',
      });
      expect(getAddressesByIds).not.toHaveBeenCalled();
    });

    it('returns 404 when the item has no business address id', async () => {
      const getAddressesByIds = jest.fn().mockResolvedValue([
        { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
      ]);
      (service as any).addressesService = { getAddressesByIds };
      hasuraUserService.getUser.mockResolvedValue({
        ...mockClientUser,
        addresses: [
          {
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            status: 'active',
            is_primary: true,
          },
        ],
      });
      hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
        if (query.includes('ClientHasOrders')) {
          return { orders_aggregate: { aggregate: { count: 1 } } };
        }
        if (query.includes('GetItem')) {
          return {
            business_inventory_by_pk: {
              ...itemDetails,
              business_location: { address_id: '' },
            },
          };
        }
        return {};
      });

      await expect(service.calculateItemDeliveryFee(itemId)).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        message: 'Business address not found',
      });
      expect(getAddressesByIds).toHaveBeenCalledTimes(1);
    });
  });
});
