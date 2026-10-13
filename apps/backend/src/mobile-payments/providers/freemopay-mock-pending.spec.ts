import { FreemopayService } from './freemopay.service';

/** #545 D7: DEV-only stuck-pending mock numbers. */
describe('FreemopayService mock pending phones', () => {
  function build(amountMockEnabled: boolean) {
    const config = {
      get: jest.fn().mockReturnValue({
        baseUrl: 'https://api-v2.freemopay.com',
        appKey: 'k',
        secretKey: 's',
        callbackUrl: '',
        amountMockEnabled,
        mockPendingPhones: ['237650000099'],
      }),
    };
    const processor = { processFreemopayCallback: jest.fn().mockResolvedValue({}) };
    const moduleRef = { get: jest.fn().mockReturnValue(processor) };
    const svc = new FreemopayService(config as any, moduleRef as any);
    return { svc, processor };
  }

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('keeps a stuck-list payer PENDING with no auto-callback; status check says PENDING', async () => {
    const { svc, processor } = build(true);
    await svc.onModuleInit();
    const res = await svc.initiatePayment({ payer: '237650000099', amount: 1500, externalId: 'ORD1-1', description: 'x', callback: '' } as any);
    expect(res.success).toBe(true);
    expect(res.transactionId).toMatch(/^mock-/);
    jest.advanceTimersByTime(5000);
    expect(processor.processFreemopayCallback).not.toHaveBeenCalled();
    const status = await svc.checkTransactionStatus(res.transactionId!);
    expect(status.status).toBe('PENDING');
    // A generated (manual) callback approves it.
    expect(svc.generateMockCallback(res.transactionId!, 'ORD1-1').status).toBe('SUCCESS');
  });

  it('other payers keep the amount rule (< 1,000,000 succeeds) with auto-callback', async () => {
    const { svc, processor } = build(true);
    await svc.onModuleInit();
    await svc.initiatePayment({ payer: '237699111222', amount: 1500, externalId: 'ORD1-2', description: 'x', callback: '' } as any);
    jest.advanceTimersByTime(2000);
    expect(processor.processFreemopayCallback).toHaveBeenCalledWith(expect.objectContaining({ status: 'SUCCESS' }));
  });

  it('is inert when the mock is off (production)', () => {
    const { svc } = build(false);
    expect((svc as any).mockPendingPhones).toEqual([]);
  });
});
