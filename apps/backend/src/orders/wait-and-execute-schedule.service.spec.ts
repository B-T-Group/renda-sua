import { WaitAndExecuteScheduleService } from './wait-and-execute-schedule.service';

describe('WaitAndExecuteScheduleService', () => {
  const env = process.env.WAIT_EXECUTE_STATE_MACHINE_ARN;
  afterEach(() => {
    if (env === undefined) delete process.env.WAIT_EXECUTE_STATE_MACHINE_ARN;
    else process.env.WAIT_EXECUTE_STATE_MACHINE_ARN = env;
    jest.useRealTimers();
  });

  function make() {
    process.env.WAIT_EXECUTE_STATE_MACHINE_ARN = 'arn:aws:states:test:000000000000:stateMachine:wait';
    const service = new WaitAndExecuteScheduleService({ get: jest.fn() } as never);
    const send = jest.fn().mockResolvedValue({ executionArn: 'exec-1' });
    (service as unknown as { sfnClient: { send: jest.Mock } }).sfnClient = { send };
    const inputs = () =>
      send.mock.calls.map((c) => JSON.parse((c[0] as { input: { input: string } }).input.input) as Record<string, unknown>);
    return { service, send, inputs };
  }

  it('#594 PR 6 (AC-A8): the slot reminder starts an order.dedicated_slot_reminder execution at now + wait', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-18T09:00:00Z') });
    const { service, inputs } = make();
    await service.scheduleDedicatedSlotReminder('order-1', 91_800);
    expect(inputs()).toEqual([
      { event_type: 'order.dedicated_slot_reminder', payload: { order_id: 'order-1' }, run_at: '2026-10-19T10:30:00.000Z' },
    ]);
  });

  it('schedules order.dedicated_heads_up_reping and clamps a non-positive wait to one second', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-30T09:00:00Z') });
    const { service, inputs } = make();
    await service.scheduleDedicatedHeadsUpReping('order-1', 720);
    await service.scheduleDedicatedHeadsUpReping('order-1', 0);
    await service.scheduleDedicatedHeadsUpReping('order-1', -30);
    expect(inputs()).toEqual([
      {
        event_type: 'order.dedicated_heads_up_reping',
        payload: { order_id: 'order-1' },
        run_at: '2026-10-30T09:12:00.000Z',
      },
      {
        event_type: 'order.dedicated_heads_up_reping',
        payload: { order_id: 'order-1' },
        run_at: '2026-10-30T09:00:01.000Z',
      },
      {
        event_type: 'order.dedicated_heads_up_reping',
        payload: { order_id: 'order-1' },
        run_at: '2026-10-30T09:00:01.000Z',
      },
    ]);
  });

  it('a non-positive wait still schedules at least one second out; a send failure does not throw', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-18T09:00:00Z') });
    const { service, send, inputs } = make();
    await service.scheduleDedicatedSlotReminder('order-1', 0);
    expect(inputs()[0].run_at).toBe('2026-10-18T09:00:01.000Z');
    send.mockRejectedValueOnce(new Error('throttled'));
    await expect(service.scheduleDedicatedSlotReminder('order-1', 10)).resolves.toBeUndefined();
  });
});
