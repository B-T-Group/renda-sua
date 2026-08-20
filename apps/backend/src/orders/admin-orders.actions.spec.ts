jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { HttpException } from '@nestjs/common';
import { AdminOrdersController } from './admin-orders.controller';
import { OrderRiskService } from './order-risk.service';

describe('AdminOrdersController actions', () => {
  function createController() {
    const ordersService = { getOrderById: jest.fn() };
    const reassignment = { reassignOrder: jest.fn() };
    const events = { recordEvent: jest.fn().mockResolvedValue(undefined) };
    const hasura = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn().mockResolvedValue({}),
    };
    const notifications = {
      sendMerchantEngagementHtmlEmail: jest.fn().mockResolvedValue(undefined),
      sendInternalSms: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new AdminOrdersController(
      ordersService as any,
      new OrderRiskService(),
      reassignment as any,
      events as any,
      hasura as any,
      notifications as any
    );
    return { controller, ordersService, reassignment, events, hasura, notifications };
  }

  async function expectHttpMessage(
    action: Promise<unknown>,
    message: string
  ): Promise<void> {
    try {
      await action;
      fail(`expected ${message}`);
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.message).toBe(message);
    }
  }

  describe('unassignAndRedispatch', () => {
    it('does not redispatch when the order is missing', async () => {
      const { controller, ordersService, reassignment } = createController();
      ordersService.getOrderById.mockResolvedValue(null);

      await expectHttpMessage(
        controller.unassignAndRedispatch('missing', {}),
        'Order not found'
      );
      expect(reassignment.reassignOrder).not.toHaveBeenCalled();
    });

    it('does not redispatch unless the order is assigned_to_agent', async () => {
      const { controller, ordersService, reassignment } = createController();
      ordersService.getOrderById.mockResolvedValue({
        id: 'ord-1',
        current_status: 'preparing',
      });

      await expectHttpMessage(
        controller.unassignAndRedispatch('ord-1', {}),
        'Order is not in assigned_to_agent status'
      );
      expect(reassignment.reassignOrder).not.toHaveBeenCalled();
    });

    it('redispatches without a reliability penalty and uses a default reason', async () => {
      const { controller, ordersService, reassignment } = createController();
      ordersService.getOrderById.mockResolvedValue({
        id: 'ord-1',
        current_status: 'assigned_to_agent',
      });
      reassignment.reassignOrder.mockResolvedValue({
        success: true,
        message: 'Order reassigned to open pool',
      });

      const actual = await controller.unassignAndRedispatch('ord-1', {});

      expect(actual).toEqual({
        success: true,
        message: 'Order reassigned to open pool',
      });
      expect(reassignment.reassignOrder).toHaveBeenCalledWith(
        'ord-1',
        'Admin-initiated reassignment',
        { skipReliabilityPenalty: true }
      );
    });

    it('forwards a custom reason and surfaces a failed reassignment', async () => {
      const { controller, ordersService, reassignment } = createController();
      ordersService.getOrderById.mockResolvedValue({
        id: 'ord-1',
        current_status: 'assigned_to_agent',
      });
      reassignment.reassignOrder.mockResolvedValue({
        success: false,
        message: 'Order not assigned',
      });

      await expectHttpMessage(
        controller.unassignAndRedispatch('ord-1', { reason: 'Agent no-show' }),
        'Order not assigned'
      );
      expect(reassignment.reassignOrder).toHaveBeenCalledWith(
        'ord-1',
        'Agent no-show',
        { skipReliabilityPenalty: true }
      );
    });
  });

  describe('updateStatus', () => {
    it('overrides status with history notes and a support event', async () => {
      const { controller, ordersService, hasura, events } = createController();
      ordersService.getOrderById.mockResolvedValue({
        id: 'ord-1',
        current_status: 'preparing',
      });

      const actual = await controller.updateStatus('ord-1', {
        status: 'ready_for_pickup',
      });

      expect(actual).toEqual({
        success: true,
        message: 'Status updated successfully',
      });
      const [mutation, variables] = hasura.executeMutation.mock.calls[0];
      expect(mutation).toContain('from_status: "preparing"');
      expect(variables).toEqual({
        orderId: 'ord-1',
        status: 'ready_for_pickup',
        notes: 'Admin status override',
      });
      expect(events.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'ord-1',
          actorType: 'support',
          payload: expect.objectContaining({
            old_status: 'preparing',
            new_status: 'ready_for_pickup',
          }),
        })
      );
    });
  });

  describe('contact channels', () => {
    const order = {
      id: 'ord-1',
      client: { user: { email: 'client@x.com', phone_number: '+237600000001' } },
      business: { user: { email: 'biz@x.com', phone_number: '+237600000002' } },
      assigned_agent: {
        user: { email: 'agent@x.com', phone_number: '+237600000003' },
      },
    };

    it('emails the selected participant and rejects a missing address', async () => {
      const { controller, ordersService, notifications } = createController();
      ordersService.getOrderById.mockResolvedValue(order);

      await controller.sendEmail('ord-1', {
        subject: 'Hello',
        message: '<p>Hi</p>',
        recipient_type: 'business',
      });
      expect(notifications.sendMerchantEngagementHtmlEmail).toHaveBeenCalledWith({
        to: 'biz@x.com',
        subject: 'Hello',
        html: '<p>Hi</p>',
      });

      ordersService.getOrderById.mockResolvedValue({ id: 'ord-1' });
      await expectHttpMessage(
        controller.sendEmail('ord-1', {
          subject: 'Hello',
          message: '<p>Hi</p>',
          recipient_type: 'client',
        }),
        'Recipient email not found'
      );
    });

    it('texts the selected participant and rejects a missing phone', async () => {
      const { controller, ordersService, notifications } = createController();
      ordersService.getOrderById.mockResolvedValue(order);

      await controller.sendSms('ord-1', {
        message: 'On the way',
        recipient_type: 'agent',
      });
      expect(notifications.sendInternalSms).toHaveBeenCalledWith(
        '+237600000003',
        'On the way'
      );

      ordersService.getOrderById.mockResolvedValue({ id: 'ord-1' });
      await expectHttpMessage(
        controller.sendSms('ord-1', {
          message: 'On the way',
          recipient_type: 'agent',
        }),
        'Recipient phone not found'
      );
    });
  });
});
