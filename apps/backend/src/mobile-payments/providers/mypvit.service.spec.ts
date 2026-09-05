import { MyPVitService } from './mypvit.service';

const AIRTEL_ACCOUNT = 'ACC_AIRTEL_TEST';
const MOOV_ACCOUNT = 'ACC_MOOV_TEST';
const STATUS_CODE = 'STATUSCODE1';

function buildService() {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'mypvit') {
        return {
          baseUrl: 'https://api.mypvit.pro',
          merchantSlug: 'MR_TEST',
          airtelSecretKey: 'airtel-secret',
          moovSecretKey: 'moov-secret',
          environment: 'test',
          callbackUrlCode: 'CB',
          secretRefreshUrlCode: 'SR',
          airtelMerchantOperationAccountCode: AIRTEL_ACCOUNT,
          moovMerchantOperationAccountCode: MOOV_ACCOUNT,
          paymentEndpointCode: 'PAYCODE',
          statusEndpointCode: STATUS_CODE,
        };
      }
      return 'development';
    }),
  };
  const service = new MyPVitService(configService as never);
  const httpGet = jest.fn();
  (service as unknown as { httpClient: { get: jest.Mock } }).httpClient = {
    get: httpGet,
  };
  jest
    .spyOn(
      service as unknown as { getCurrentSecretKey: (p?: string) => Promise<string> },
      'getCurrentSecretKey'
    )
    .mockResolvedValue('test-secret');
  return { service, httpGet };
}

const successBody = {
  status: 'SUCCESS',
  merchant_reference_id: 'PAYTEST001',
  amount: 150,
  currency: 'XAF',
};

describe('MyPVitService.checkTransactionStatus', () => {
  it('queries GET /{code}/status/{transactionId} first', async () => {
    const { service, httpGet } = buildService();
    httpGet.mockResolvedValue({ data: successBody });

    const result = await service.checkTransactionStatus(
      'PAYTEST001',
      '+24174123456'
    );

    expect(httpGet).toHaveBeenCalledTimes(1);
    expect(httpGet).toHaveBeenCalledWith('/STATUSCODE1/status/PAYTEST001', {
      headers: { 'X-Secret': 'test-secret' },
    });
    expect(result.status).toBe('SUCCESS');
  });

  it('falls back to query params when the path-style URL returns 404', async () => {
    const { service, httpGet } = buildService();
    httpGet
      .mockRejectedValueOnce({ response: { status: 404 } })
      .mockResolvedValueOnce({ data: successBody });

    const result = await service.checkTransactionStatus(
      'PAYTEST001',
      '+24174123456'
    );

    expect(httpGet).toHaveBeenNthCalledWith(2, '/STATUSCODE1/status', {
      params: {
        transactionId: 'PAYTEST001',
        accountOperationCode: AIRTEL_ACCOUNT,
        transactionOperation: 'PAYMENT',
      },
      headers: { 'X-Secret': 'test-secret' },
    });
    expect(result.status).toBe('SUCCESS');
  });

  it('uses the MOOV account code for E.164 MOOV numbers on query fallback', async () => {
    const { service, httpGet } = buildService();
    httpGet
      .mockRejectedValueOnce({ response: { status: 404 } })
      .mockResolvedValueOnce({ data: successBody });

    await service.checkTransactionStatus('PAYTEST001', '+24166123456');

    expect(httpGet).toHaveBeenNthCalledWith(
      2,
      '/STATUSCODE1/status',
      expect.objectContaining({
        params: expect.objectContaining({
          accountOperationCode: MOOV_ACCOUNT,
        }),
      })
    );
  });
});

describe('MyPVitService.getMerchantOperationAccountCode', () => {
  it('maps E.164 MOOV numbers to the MOOV account', () => {
    const { service } = buildService();
    expect(service.getMerchantOperationAccountCode('+24166123456')).toBe(
      MOOV_ACCOUNT
    );
  });

  it('maps E.164 Airtel numbers to the Airtel account', () => {
    const { service } = buildService();
    expect(service.getMerchantOperationAccountCode('+24174123456')).toBe(
      AIRTEL_ACCOUNT
    );
  });
});
