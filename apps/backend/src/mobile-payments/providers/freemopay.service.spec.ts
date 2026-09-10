import { FreemopayService } from './freemopay.service';

function buildService() {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'freemopay') {
        return {
          baseUrl: 'https://api-v2.freemopay.com',
          appKey: 'app',
          secretKey: 'secret',
          callbackUrl: 'https://example.test/callback',
        };
      }
      return undefined;
    }),
  };
  const service = new FreemopayService(configService as never);
  const httpPost = jest.fn();
  (service as unknown as { httpClient: { post: jest.Mock } }).httpClient = {
    post: httpPost,
  };
  return { service, httpPost };
}

const paymentRequest = {
  payer: '+237670000000',
  amount: 1500,
  externalId: 'ORD-TEST-1',
  description: 'Order test',
  callback: 'https://example.test/callback',
};

describe('FreemopayService.initiatePayment', () => {
  it('stores Nest-style array error messages as a single string', async () => {
    const { service, httpPost } = buildService();
    httpPost.mockRejectedValue({
      response: {
        status: 400,
        data: {
          statusCode: 400,
          message: ['payer must be a phone number', 'amount must be positive'],
        },
      },
    });

    const result = await service.initiatePayment(paymentRequest, 'ORD-TEST-1');

    expect(result.success).toBe(false);
    expect(result.message).toBe(
      'payer must be a phone number; amount must be positive'
    );
    expect(result.errorCode).toBe('400');
    expect(typeof result.message).toBe('string');
  });

  it('keeps a string provider message unchanged', async () => {
    const { service, httpPost } = buildService();
    httpPost.mockRejectedValue({
      response: {
        status: 400,
        data: { message: 'Insufficient funds', statusCode: 400 },
      },
    });

    const result = await service.initiatePayment(paymentRequest);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Insufficient funds');
  });
});
