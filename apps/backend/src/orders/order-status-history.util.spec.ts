import {
  CREATE_STATUS_HISTORY_MUTATION,
  insertOrderStatusHistory,
  statusHistoryUserId,
  statusHistoryVariables,
} from './order-status-history.util';

describe('order-status-history.util', () => {
  const validUserId = '11111111-1111-4111-8111-111111111111';

  describe('statusHistoryUserId', () => {
    it('keeps a canonical user UUID', () => {
      expect(statusHistoryUserId(` ${validUserId} `)).toBe(validUserId);
    });

    it('drops the system sentinel and other non-UUIDs', () => {
      expect(statusHistoryUserId('system')).toBeNull();
      expect(statusHistoryUserId('client')).toBeNull();
      expect(statusHistoryUserId('')).toBeNull();
      expect(statusHistoryUserId(null)).toBeNull();
      expect(statusHistoryUserId(undefined)).toBeNull();
    });
  });

  describe('statusHistoryVariables', () => {
    it('sends null instead of "system" for changed_by_user_id', () => {
      expect(
        statusHistoryVariables({
          orderId: validUserId,
          status: 'ready_for_pickup',
          notes: 'Auto-marked ready after prep timer',
          changedByType: 'system',
          changedByUserId: 'system',
        })
      ).toEqual({
        orderId: validUserId,
        status: 'ready_for_pickup',
        notes: 'Auto-marked ready after prep timer',
        changedByType: 'system',
        changedByUserId: null,
      });
    });
  });

  describe('insertOrderStatusHistory', () => {
    it('uses a nullable uuid variable so system rows omit a user id', async () => {
      const executeMutation = jest.fn().mockResolvedValue({ affected_rows: 1 });

      await insertOrderStatusHistory(
        { executeMutation },
        {
          orderId: validUserId,
          status: 'ready_for_pickup',
          notes: 'Auto-marked ready after prep timer',
          changedByType: 'system',
          changedByUserId: 'system',
        }
      );

      expect(CREATE_STATUS_HISTORY_MUTATION).toContain('$changedByUserId: uuid');
      expect(CREATE_STATUS_HISTORY_MUTATION).not.toContain(
        '$changedByUserId: uuid!'
      );
      expect(executeMutation).toHaveBeenCalledWith(
        CREATE_STATUS_HISTORY_MUTATION,
        expect.objectContaining({
          changedByType: 'system',
          changedByUserId: null,
        })
      );
    });
  });
});
