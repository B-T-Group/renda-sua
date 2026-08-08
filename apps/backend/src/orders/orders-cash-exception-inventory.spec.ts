import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AccountsService } from '../accounts/accounts.service';
import { AddressesService } from '../addresses/addresses.service';
import { AgentHoldService } from '../agents/agent-hold.service';
import { CommissionsService } from '../commissions/commissions.service';
import { DeliveryAvailabilityService } from '../delivery-availability/delivery-availability.service';
import { DeliveryConfigService } from '../delivery-configs/delivery-configs.service';
import { DeliveryWindowsService } from '../delivery/delivery-windows.service';
import { DeliveryPinService } from '../delivery-pin/delivery-pin.service';
import { GoogleDistanceService } from '../google/google-distance.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { LocationsService } from '../locations/locations.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { DeliveryPinShareService } from '../messaging/structured/delivery-pin-share.service';
import { MobilePaymentsDatabaseService } from '../mobile-payments/mobile-payments-database.service';
import { MobilePaymentsService } from '../mobile-payments/mobile-payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PdfService } from '../pdf/pdf.service';
import { RbacService } from '../rbac/rbac.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import { StripeCaptureService } from '../stripe-payments/stripe-capture.service';
import { StripeCheckoutService } from '../stripe-payments/stripe-checkout.service';
import { StripeTaxCalculationService } from '../stripe-tax/stripe-tax-calculation.service';
import { StripeTaxCheckoutBuilderService } from '../stripe-tax/stripe-tax-checkout-builder.service';
import { CancellationPolicyService } from './cancellation-policy.service';
import { OrderAcceptanceService } from './order-acceptance.service';
import { OrderEventsService } from './order-events.service';
import { OrderOffersService } from './order-offers.service';
import { OrderPickupMonitorService } from './order-pickup-monitor.service';
import { OrderQueueService } from './order-queue.service';
import { OrderReassignmentService } from './order-reassignment.service';
import { OrderRefundsService } from './order-refunds.service';
import { OrderStatusService } from './order-status.service';
import { OrderSystemJobsService } from './order-system-jobs.service';
import { OrdersService } from './orders.service';
import { WaitAndExecuteScheduleService } from './wait-and-execute-schedule.service';

describe('OrdersService markPaidInCashException inventory', () => {
  let service: OrdersService;
  let hasuraUserService: {
    getUser: jest.Mock;
    sessionPersonaContext: jest.Mock;
  };
  let hasuraSystemService: {
    executeMutation: jest.Mock;
    executeQuery: jest.Mock;
  };
  let orderQueueService: { sendOrderCompletedMessage: jest.Mock };

  const agentUser = {
    id: 'agent-user-1',
    active_persona: 'agent',
    agent: { id: 'agent-1', user_id: 'agent-user-1' },
  };

  const baseOrder = {
    id: 'order-1',
    order_number: 'ORD-1',
    assigned_agent_id: 'agent-1',
    payment_timing: 'pay_at_delivery',
    current_status: 'out_for_delivery',
    reconciliation_status: 'none',
    order_items: [
      { business_inventory_id: 'inv-1', quantity: 2 },
      { business_inventory_id: 'inv-2', quantity: 1 },
    ],
    client: { user_id: 'client-1' },
  };

  beforeEach(async () => {
    hasuraUserService = {
      getUser: jest.fn().mockResolvedValue(agentUser),
      sessionPersonaContext: jest.fn().mockReturnValue({
        jwtDefaultRole: 'agent',
        jwtAllowedRoles: ['agent'],
      }),
    };
    hasuraSystemService = {
      executeMutation: jest.fn().mockResolvedValue({
        update_orders: { affected_rows: 1 },
      }),
      executeQuery: jest.fn().mockResolvedValue({
        update_business_inventory_by_pk: { id: 'inv-1' },
      }),
    };
    orderQueueService = {
      sendOrderCompletedMessage: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: HasuraUserService, useValue: hasuraUserService },
        { provide: HasuraSystemService, useValue: hasuraSystemService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: AgentHoldService, useValue: {} },
        { provide: AccountsService, useValue: {} },
        { provide: OrderStatusService, useValue: {} },
        { provide: GoogleDistanceService, useValue: {} },
        { provide: AddressesService, useValue: {} },
        { provide: MobilePaymentsService, useValue: {} },
        { provide: MobilePaymentsDatabaseService, useValue: {} },
        {
          provide: NotificationsService,
          useValue: {
            sendRateAgentPromptPush: jest.fn(),
          },
        },
        { provide: DeliveryConfigService, useValue: {} },
        { provide: DeliveryWindowsService, useValue: {} },
        { provide: CommissionsService, useValue: {} },
        { provide: PdfService, useValue: {} },
        { provide: OrderQueueService, useValue: orderQueueService },
        { provide: WaitAndExecuteScheduleService, useValue: {} },
        { provide: DeliveryPinService, useValue: {} },
        { provide: DeliveryPinShareService, useValue: {} },
        { provide: OrderRefundsService, useValue: {} },
        {
          provide: LoyaltyService,
          useValue: { handleOrderCompletionRewards: jest.fn() },
        },
        { provide: PaymentRoutingService, useValue: {} },
        { provide: StripeCheckoutService, useValue: {} },
        { provide: StripeCaptureService, useValue: {} },
        {
          provide: StripeTaxCheckoutBuilderService,
          useValue: {
            isTaxEnabledForCountry: jest.fn().mockReturnValue(false),
            normalizeCountryCode: jest.fn((c: string) => c),
          },
        },
        { provide: StripeTaxCalculationService, useValue: {} },
        { provide: OrderOffersService, useValue: {} },
        { provide: CancellationPolicyService, useValue: {} },
        { provide: LocationsService, useValue: {} },
        { provide: OrderSystemJobsService, useValue: {} },
        { provide: OrderPickupMonitorService, useValue: {} },
        { provide: OrderReassignmentService, useValue: {} },
        { provide: OrderEventsService, useValue: {} },
        { provide: OrderAcceptanceService, useValue: {} },
        { provide: RbacService, useValue: {} },
        { provide: DeliveryAvailabilityService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get(OrdersService);
    jest.spyOn(service as any, 'getOrderDetails').mockResolvedValue(baseOrder);
    jest
      .spyOn(service as any, 'createStatusHistoryEntry')
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'handleOrderCompletionRewards')
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'sendRateAgentPromptToClient')
      .mockResolvedValue(undefined);
  });

  it('decrements reserved and on-hand quantity for each line item', async () => {
    const result = await service.markPaidInCashException('order-1', 'paid cash');

    expect(result.success).toBe(true);
    expect(hasuraSystemService.executeMutation).toHaveBeenCalled();
    const inventoryCalls = hasuraSystemService.executeQuery.mock.calls.filter(
      (c) => String(c[0]).includes('UpdateInventoryOnCompletion')
    );
    expect(inventoryCalls).toHaveLength(2);
    expect(inventoryCalls[0][1]).toEqual({
      id: 'inv-1',
      reservedQuantity: -2,
      quantity: -2,
    });
    expect(inventoryCalls[1][1]).toEqual({
      id: 'inv-2',
      reservedQuantity: -1,
      quantity: -1,
    });
  });

  it('does not adjust inventory when CAS claim loses the race', async () => {
    hasuraSystemService.executeMutation.mockResolvedValue({
      update_orders: { affected_rows: 0 },
    });

    const result = await service.markPaidInCashException('order-1');

    expect(result.message).toMatch(/already recorded/i);
    const inventoryCalls = hasuraSystemService.executeQuery.mock.calls.filter(
      (c) => String(c[0]).includes('UpdateInventoryOnCompletion')
    );
    expect(inventoryCalls).toHaveLength(0);
  });

  it('is idempotent when reconciliation is already pending', async () => {
    jest.spyOn(service as any, 'getOrderDetails').mockResolvedValue({
      ...baseOrder,
      current_status: 'complete',
      reconciliation_status: 'pending_manual_reconciliation',
    });

    const result = await service.markPaidInCashException('order-1');

    expect(result.message).toMatch(/already recorded/i);
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
  });
});
