import { HttpException, HttpStatus } from '@nestjs/common';
import { OrderStatusService } from './order-status.service';

/** QA #559/#560 follow-up: F1 (delivered → complete), F2 (parallel completion), build fix. */
describe('OrderStatusService completion guard (F1/F2)', () => {
  const hasura = { executeQuery: jest.fn(), executeMutation: jest.fn() };
  const users = { getUser: jest.fn() };
  const queue = { sendOrderStatusUpdatedMessage: jest.fn() };
  const referrals = { creditAfterFirstDelivery: jest.fn() };
  const routing = { getUserCountryCode: jest.fn() };
  const compensation = { evaluateForOrderSafe: jest.fn() };
  let service: OrderStatusService;

  const order = (current_status: string) => ({
    id: 'order-1',
    order_number: 'ORD-1',
    current_status,
    business_id: 'biz-1',
    business: { user_id: 'biz-user' },
    assigned_agent_id: 'agent-1',
    assigned_agent: { user_id: 'agent-user' },
    client_id: 'client-1',
    client: { user_id: 'client-user' },
  });

  const reads = (before: string, after?: { current_status: string; completed_at: string | null }) =>
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('CheckOrderStatus')) {
        return { orders_by_pk: after ? { id: 'order-1', ...after } : null };
      }
      return { orders_by_pk: order(before) };
    });

  const updateResult = (affected_rows: number, row?: Record<string, unknown>) => ({
    update_orders: { affected_rows, returning: row ? [row] : [] },
  });

  beforeEach(() => {
    jest.resetAllMocks();
    service = new OrderStatusService(
      hasura as never,
      users as never,
      queue as never,
      referrals as never,
      routing as never,
      compensation as never
    );
    users.getUser.mockResolvedValue({ id: 'agent-user', agent: { id: 'agent-1' }, active_persona: 'agent' });
    routing.getUserCountryCode.mockResolvedValue('CM');
    queue.sendOrderStatusUpdatedMessage.mockResolvedValue(undefined);
  });

  describe('F1 delivered → complete', () => {
    beforeEach(() => {
      users.getUser.mockResolvedValue({ id: 'client-user', active_persona: 'client' });
    });

    it('does not guard on completed_at IS NULL and keeps an existing completed_at', async () => {
      reads('delivered');
      hasura.executeMutation.mockResolvedValue(
        updateResult(1, { id: 'order-1', current_status: 'complete', completed_at: '2026-10-01T10:00:00Z' })
      );

      const row = await service.updateOrderStatus('order-1', 'complete');

      expect(row.current_status).toBe('complete');
      expect(row.completed_at).toBe('2026-10-01T10:00:00Z');
      expect(hasura.executeMutation).toHaveBeenCalledTimes(1);
      const mutation = hasura.executeMutation.mock.calls[0][0] as string;
      expect(mutation).not.toContain('completed_at: { _is_null: true }');
      expect(mutation).not.toContain('completed_at: "now()"');
      expect(mutation).toContain('current_status: { _eq: $previousStatus }');
    });

    it('backfills completed_at only when the legacy delivered order had none', async () => {
      reads('delivered');
      hasura.executeMutation
        .mockResolvedValueOnce(updateResult(1, { id: 'order-1', current_status: 'complete', completed_at: null }))
        .mockResolvedValueOnce({ update_orders: { affected_rows: 1 } });

      await service.updateOrderStatus('order-1', 'complete');

      expect(hasura.executeMutation).toHaveBeenCalledTimes(2);
      const backfill = hasura.executeMutation.mock.calls[1][0] as string;
      expect(backfill).toContain('BackfillOrderCompletedAt');
      expect(backfill).toContain('completed_at: { _is_null: true }');
    });

    it('still 409s when the delivered row really did not update', async () => {
      reads('delivered', { current_status: 'delivered', completed_at: '2026-10-01T10:00:00Z' });
      hasura.executeMutation.mockResolvedValue(updateResult(0));

      await expect(
        service.updateOrderStatus('order-1', 'complete')
      ).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
      expect(queue.sendOrderStatusUpdatedMessage).not.toHaveBeenCalled();
    });

    it('keeps the completed_at IS NULL guard for out_for_delivery → complete', async () => {
      users.getUser.mockResolvedValue({ id: 'agent-user', agent: { id: 'agent-1' }, active_persona: 'agent' });
      reads('out_for_delivery');
      hasura.executeMutation.mockResolvedValue(
        updateResult(1, { id: 'order-1', current_status: 'complete', completed_at: '2026-10-13T12:00:00Z' })
      );

      await service.updateOrderStatus('order-1', 'complete');

      const mutation = hasura.executeMutation.mock.calls[0][0] as string;
      expect(mutation).toContain('completed_at: { _is_null: true }');
      expect(mutation).toContain('completed_at: "now()"');
    });
  });

  describe('F2 parallel completion loser', () => {
    it('reports a replay and emits no status message, referral or accrual', async () => {
      reads('out_for_delivery', { current_status: 'complete', completed_at: '2026-10-13T12:00:00Z' });
      hasura.executeMutation.mockResolvedValue(updateResult(0));
      const onSameStatusReplay = jest.fn();

      const row = await service.updateOrderStatus('order-1', 'complete', { onSameStatusReplay });

      expect(row.current_status).toBe('complete');
      expect(onSameStatusReplay).toHaveBeenCalledTimes(1);
      expect(queue.sendOrderStatusUpdatedMessage).not.toHaveBeenCalled();
      expect(referrals.creditAfterFirstDelivery).not.toHaveBeenCalled();
      expect(compensation.evaluateForOrderSafe).not.toHaveBeenCalled();
    });

    it('winner does not report a replay', async () => {
      reads('out_for_delivery');
      hasura.executeMutation.mockResolvedValue(
        updateResult(1, { id: 'order-1', current_status: 'complete', completed_at: '2026-10-13T12:00:00Z' })
      );
      const onSameStatusReplay = jest.fn();

      await service.updateOrderStatus('order-1', 'complete', { onSameStatusReplay });

      expect(onSameStatusReplay).not.toHaveBeenCalled();
      expect(queue.sendOrderStatusUpdatedMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('build fix: ensureSingleStatusRowUpdated is the 409 path', () => {
    it('throws 409 for a 0-row non-completion update', async () => {
      users.getUser.mockResolvedValue({ id: 'biz-user', business: { id: 'biz-1' }, active_persona: 'business' });
      reads('confirmed');
      hasura.executeMutation.mockResolvedValue(updateResult(0));

      const error = await service
        .updateOrderStatus('order-1', 'preparing', { viaSystem: true })
        .catch((e) => e);
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
    });
  });
});
