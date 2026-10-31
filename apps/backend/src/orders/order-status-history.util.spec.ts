import {
  CREATE_STATUS_HISTORY_MUTATION,
  insertOrderStatusHistory,
  normalizeChangedByType,
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

  describe('normalizeChangedByType', () => {
    it('keeps the four check-constraint values', () => {
      expect(normalizeChangedByType('client')).toBe('client');
      expect(normalizeChangedByType('business')).toBe('business');
      expect(normalizeChangedByType('agent')).toBe('agent');
      expect(normalizeChangedByType('system')).toBe('system');
    });

    it('maps the client-confirm "user" sentinel to client', () => {
      expect(normalizeChangedByType('user')).toBe('client');
      expect(normalizeChangedByType('USER')).toBe('client');
    });

    it('maps admin and delegate aliases and unknown values to allowed types', () => {
      expect(normalizeChangedByType('admin')).toBe('system');
      expect(normalizeChangedByType('delegate')).toBe('business');
      expect(normalizeChangedByType('')).toBe('system');
      expect(normalizeChangedByType(null)).toBe('system');
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

    it('does not send "user" as changed_by_type', () => {
      expect(
        statusHistoryVariables({
          orderId: validUserId,
          status: 'awaiting_client_confirmation',
          notes: 'Agent marked delivered',
          changedByType: 'user',
          changedByUserId: validUserId,
        }).changedByType
      ).toBe('client');
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
