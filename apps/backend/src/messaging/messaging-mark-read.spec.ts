import { HttpException, HttpStatus } from '@nestjs/common';
import {
  GET_LAST_MESSAGE_CREATED_AT,
  GET_MESSAGES_TO_MARK_READ,
  MARK_MESSAGES_READ,
  MessagingService,
} from './messaging.service';

const LAST_ID = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const MSG_A = '44444444-4444-4444-8444-444444444444';

interface MessagingHarness {
  markMessagesRead: MessagingService['markMessagesRead'];
  hasuraUserService: { getUser: jest.Mock };
  hasuraSystemService: {
    executeQuery: jest.Mock;
    executeMutation: jest.Mock;
  };
  loadOrderForMessaging: jest.Mock;
  assertMessagingAccess: jest.Mock;
}

function declaredGraphQLVariables(document: string): string[] {
  const header = document.match(/\([^)]+\)/)?.[0] ?? '';
  return [...header.matchAll(/\$(\w+)/g)].map((m) => m[1]);
}

function usedGraphQLVariables(document: string): string[] {
  const body = document.replace(/^[^(]*\([^)]*\)/, '');
  return [...body.matchAll(/\$(\w+)/g)].map((m) => m[1]);
}

describe('MessagingService.markMessagesRead', () => {
  let executeQuery: jest.Mock;
  let executeMutation: jest.Mock;
  let service: MessagingHarness;

  beforeEach(() => {
    executeQuery = jest.fn();
    executeMutation = jest.fn();
    service = Object.create(MessagingService.prototype) as MessagingHarness;
    service.hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({ id: USER_ID }),
    };
    service.hasuraSystemService = { executeQuery, executeMutation };
    service.loadOrderForMessaging = jest
      .fn()
      .mockResolvedValue({ id: ORDER_ID });
    service.assertMessagingAccess = jest.fn();
  });

  it('does not declare unused variables on the last-message lookup', () => {
    const declared = declaredGraphQLVariables(GET_LAST_MESSAGE_CREATED_AT);
    const used = usedGraphQLVariables(GET_LAST_MESSAGE_CREATED_AT);
    expect(declared).toEqual(['lastId']);
    expect(used).toEqual(['lastId']);
  });

  it('rejects a non-UUID lastReadMessageId before querying Hasura', async () => {
    try {
      await service.markMessagesRead(ORDER_ID, 'not-a-uuid');
      fail('expected throw');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
    expect(service.hasuraUserService.getUser).not.toHaveBeenCalled();
    expect(executeQuery).not.toHaveBeenCalled();
  });

  it('looks up the last message by id only, then upserts reads', async () => {
    executeQuery
      .mockResolvedValueOnce({
        last_message: [{ created_at: '2026-08-28T00:00:00.000Z' }],
      })
      .mockResolvedValueOnce({ user_messages: [{ id: MSG_A }] });
    executeMutation.mockResolvedValue({
      insert_message_reads: { affected_rows: 1 },
    });

    await service.markMessagesRead(ORDER_ID, LAST_ID);

    expect(executeQuery).toHaveBeenNthCalledWith(
      1,
      GET_LAST_MESSAGE_CREATED_AT,
      { lastId: LAST_ID }
    );
    expect(executeQuery).toHaveBeenNthCalledWith(2, GET_MESSAGES_TO_MARK_READ, {
      orderId: ORDER_ID,
      entityType: 'order',
      upTo: '2026-08-28T00:00:00.000Z',
    });
    expect(executeMutation).toHaveBeenCalledWith(MARK_MESSAGES_READ, {
      objects: [{ message_id: MSG_A, user_id: USER_ID }],
    });
  });

  it('no-ops when the last-read message is unknown', async () => {
    executeQuery.mockResolvedValueOnce({ last_message: [] });

    await service.markMessagesRead(ORDER_ID, LAST_ID);

    expect(executeQuery).toHaveBeenCalledTimes(1);
    expect(executeMutation).not.toHaveBeenCalled();
  });
});
