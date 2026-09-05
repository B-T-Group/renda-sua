import { HttpException, HttpStatus } from '@nestjs/common';
import { AdminOrderContactService } from './admin-order-contact.service';

describe('AdminOrderContactService', () => {
  const order = {
    id: 'order-1',
    order_number: 'RS-1001',
    client: { user_id: 'client-user' },
    business: { user_id: 'business-user' },
    assigned_agent: { user_id: 'agent-user' },
  };

  function buildService(opts?: {
    insertMessage?: { id: string } | null;
    getUser?: { id: string; first_name: string; last_name: string };
  }) {
    const executeMutation = jest.fn(async (mutation: string) => {
      if (mutation.includes('CreateAdminOrderContactMessage')) {
        return {
          insert_user_messages_one:
            opts && 'insertMessage' in opts
              ? opts.insertMessage
              : { id: 'msg-1' },
        };
      }
      if (mutation.includes('InsertAdminOrderContactRecipient')) {
        return { insert_message_recipients: { affected_rows: 1 } };
      }
      return {};
    });
    const hasuraUserService = {
      getUser: jest.fn().mockResolvedValue(
        opts?.getUser ?? {
          id: 'admin-user',
          first_name: 'Ada',
          last_name: 'Admin',
        }
      ),
    };
    const notificationsService = {
      sendNewOrderMessagePush: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AdminOrderContactService(
      { executeMutation } as any,
      hasuraUserService as any,
      notificationsService as any
    );
    return { service, executeMutation, hasuraUserService, notificationsService };
  }

  it('inserts user_messages with schema fields instead of message_text', async () => {
    const { service, executeMutation, notificationsService } = buildService();

    const created = await service.sendInAppMessage({
      order,
      message: 'Need a pickup update',
      recipientType: 'client',
    });

    expect(created).toEqual({ id: 'msg-1' });
    const [mutation, variables] = executeMutation.mock.calls[0];
    expect(mutation).toContain('message: $message');
    expect(mutation).toContain('entity_id: $orderId');
    expect(mutation).toContain('user_id: $userId');
    expect(mutation).not.toContain('message_text');
    expect(mutation).not.toContain('order_id:');
    expect(mutation).not.toContain('is_from_support');
    expect(variables).toEqual({
      userId: 'admin-user',
      orderId: 'order-1',
      message: 'Need a pickup update',
    });
    expect(executeMutation.mock.calls[1][1]).toEqual({
      objects: [
        {
          message_id: 'msg-1',
          recipient_user_id: 'client-user',
          recipient_type: 'client',
        },
      ],
    });
    expect(notificationsService.sendNewOrderMessagePush).toHaveBeenCalledWith({
      recipientUserId: 'client-user',
      orderId: 'order-1',
      orderNumber: 'RS-1001',
      senderName: 'Ada Admin',
      messageId: 'msg-1',
    });
  });

  it('rejects an empty message', async () => {
    const { service, executeMutation } = buildService();
    await expectHttpStatus(
      service.sendInAppMessage({
        order,
        message: '   ',
        recipientType: 'client',
      }),
      HttpStatus.BAD_REQUEST
    );
    expect(executeMutation).not.toHaveBeenCalled();
  });

  it('rejects a missing agent recipient', async () => {
    const { service, executeMutation } = buildService();
    await expectHttpStatus(
      service.sendInAppMessage({
        order: { ...order, assigned_agent: null },
        message: 'Hello',
        recipientType: 'agent',
      }),
      HttpStatus.BAD_REQUEST
    );
    expect(executeMutation).not.toHaveBeenCalled();
  });

  it('throws when the insert returns no row', async () => {
    const { service } = buildService({ insertMessage: null });
    await expectHttpStatus(
      service.sendInAppMessage({
        order,
        message: 'Hello',
        recipientType: 'business',
      }),
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  });
});

async function expectHttpStatus(
  promise: Promise<unknown>,
  status: HttpStatus
): Promise<void> {
  try {
    await promise;
    throw new Error('expected HttpException');
  } catch (error: any) {
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(status);
  }
}
