jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
jest.mock('../commissions/commissions.service', () => ({
  CommissionsService: class CommissionsService {},
}));

import { OrdersService } from './orders.service';

describe('OrdersService markPaidInCashException inventory', () => {
  const agentUser = { id: 'user-agent-1', agent: { id: 'agent-1' } };
  const orderItems = [
    { id: 'oi-1', business_inventory_id: 'inv-1', quantity: 2 },
  ];

  let service: OrdersService;
  let hasuraUserService: {
    getUser: jest.Mock;
    sessionPersonaContext: jest.Mock;
  };
  let hasuraSystemService: { executeMutation: jest.Mock };
  let getOrderDetails: jest.SpyInstance;
  let updateInventory: jest.SpyInstance;

  beforeEach(() => {
    hasuraUserService = {
      getUser: jest.fn().mockResolvedValue(agentUser),
      sessionPersonaContext: jest.fn().mockReturnValue({
        activePersona: 'agent',
        jwtDefaultRole: 'agent',
        jwtAllowedRoles: ['agent'],
      }),
    };
    hasuraSystemService = { executeMutation: jest.fn().mockResolvedValue({}) };
    service = Object.create(OrdersService.prototype) as OrdersService;
    Object.assign(service, {
      hasuraUserService,
      hasuraSystemService,
      orderQueueService: {
        sendOrderCompletedMessage: jest.fn().mockResolvedValue(undefined),
      },
      logger: { error: jest.fn(), log: jest.fn(), warn: jest.fn() },
    });
    getOrderDetails = jest.spyOn(service as any, 'getOrderDetails');
    updateInventory = jest
      .spyOn(service as any, 'updateInventoryOnCompletion')
      .mockResolvedValue(undefined);
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

  function cashOrder(overrides: Record<string, unknown> = {}) {
    return {
      id: 'ord-1',
      assigned_agent_id: 'agent-1',
      payment_timing: 'pay_at_delivery',
      current_status: 'out_for_delivery',
      order_items: orderItems,
      ...overrides,
    };
  }

  it('decrements inventory when a cash exception completes the order', async () => {
    getOrderDetails.mockResolvedValue(cashOrder());

    await expect(service.markPaidInCashException('ord-1')).resolves.toEqual({
      success: true,
      message: 'Cash exception recorded',
    });
    expect(updateInventory).toHaveBeenCalledWith(orderItems);
  });

  it('does not adjust inventory when the cash exception was already recorded', async () => {
    getOrderDetails.mockResolvedValue(
      cashOrder({ reconciliation_status: 'pending_manual_reconciliation' })
    );

    await expect(service.markPaidInCashException('ord-1')).resolves.toEqual({
      success: true,
      message: 'Cash exception already recorded',
    });
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
    expect(updateInventory).not.toHaveBeenCalled();
  });

  it('still completes the order if inventory adjustment throws', async () => {
    getOrderDetails.mockResolvedValue(cashOrder());
    updateInventory.mockRejectedValue(new Error('stock write failed'));

    await expect(service.markPaidInCashException('ord-1')).resolves.toEqual({
      success: true,
      message: 'Cash exception recorded',
    });
    expect(updateInventory).toHaveBeenCalledWith(orderItems);
  });
});
