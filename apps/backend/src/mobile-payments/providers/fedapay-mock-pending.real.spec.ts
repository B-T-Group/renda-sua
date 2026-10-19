/**
 * M2: a FEDAPAY_MOCK_PENDING_PHONES payer must stay pending. The G2 callers call
 * scheduleMockCallback for every mock- id after persisting it, so the real
 * FedaPayService (DEV mock mode, no SDK calls) must not turn 'pending' into approved.
 */
import { Logger } from '@nestjs/common';
import { FedaPayService } from './fedapay.service';

jest.mock('fedapay', () => ({
  FedaPay: { setApiKey: jest.fn(), setEnvironment: jest.fn() },
  Transaction: { create: jest.fn(), retrieve: jest.fn() },
  Payout: { create: jest.fn(), retrieve: jest.fn(), all: jest.fn() },
  Webhook: { constructEvent: jest.fn() },
}));

describe('M2: FedaPay DEV mock pending phones never auto-approve', () => {
  const previousEnv = process.env.DEPLOYMENT_ENV;
  let processor: { processFedaPayCallback: jest.Mock };

  beforeAll(() => {
    process.env.DEPLOYMENT_ENV = 'test';
  });
  afterAll(() => {
    process.env.DEPLOYMENT_ENV = previousEnv;
  });
  beforeEach(() => {
    jest.useFakeTimers();
    for (const level of ['log', 'warn', 'error', 'debug'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation(() => undefined);
    }
    processor = { processFedaPayCallback: jest.fn().mockResolvedValue({ received: true }) };
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function fedapay(): FedaPayService {
    const svc = new FedaPayService(
      {
        get: (key: string) =>
          key === 'fedapay'
            ? {
                secretKey: 'sk_sandbox_x',
                environment: 'sandbox',
                mockEnabled: true,
                mockPendingPhones: ['22890000001'],
              }
            : undefined,
      } as any,
      { get: jest.fn().mockReturnValue(processor) } as any
    );
    (svc as any).callbackProcessor = processor;
    return svc;
  }

  async function initiateAndSchedule(svc: FedaPayService, payer: string) {
    const res = await svc.initiatePayment(
      { payer, amount: 1000, currency: 'XOF', channel: 'togocel', externalId: 'REF-P' } as any,
      'REF-P'
    );
    expect(res.success).toBe(true);
    expect(String(res.transactionId)).toMatch(/^mock-/);
    // What every G2 caller does after persisting the mock id.
    svc.scheduleMockCallback(String(res.transactionId), 'REF-P');
    await jest.advanceTimersByTimeAsync(60_000);
    return res;
  }

  it('a pending-list payer gets no callback at all (stays pending)', async () => {
    const svc = fedapay();
    const res = await initiateAndSchedule(svc, '90000001');

    expect(res.status).toBe('pending');
    expect(processor.processFedaPayCallback).not.toHaveBeenCalled();
    const live = await svc.checkTransactionStatus(String(res.transactionId));
    expect(live.status).toBe('pending');
  });

  it('a normal mock payer still gets its approved callback', async () => {
    const svc = fedapay();
    await initiateAndSchedule(svc, '90123456');

    expect(processor.processFedaPayCallback).toHaveBeenCalledTimes(1);
    expect(processor.processFedaPayCallback.mock.calls[0][0]).toEqual(
      expect.objectContaining({ name: 'transaction.approved' })
    );
  });
});
