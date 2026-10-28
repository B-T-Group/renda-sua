import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { MtnMomoDatabaseService } from './mtn-momo-database.service';
import { signMtnWebhookToken } from './mtn-momo-webhook-token.util';
import { MtnMomoService } from './mtn-momo.service';

const http = { post: jest.fn(), get: jest.fn() };
const createAxios = jest.fn((_: unknown) => http);
jest.mock('axios', () => ({
  __esModule: true,
  default: { create: (opts: unknown) => createAxios(opts) },
}));

const REF = '3f1c6a52-8f0e-4c0a-9a53-0e1c8f7a2b11';

const BASE_ENV: Record<string, string> = {
  MTN_MOMO_TARGET_ENVIRONMENT: 'sandbox',
  MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY: 'col-sub',
  MTN_MOMO_COLLECTION_API_USER_ID: 'col-user',
  MTN_MOMO_COLLECTION_API_KEY: 'col-key',
  MTN_MOMO_DISBURSEMENT_SUBSCRIPTION_KEY: 'dis-sub',
  MTN_MOMO_DISBURSEMENT_API_USER_ID: 'dis-user',
  MTN_MOMO_DISBURSEMENT_API_KEY: 'dis-key',
  MTN_MOMO_CALLBACK_URL: 'https://rendasua.com/dev/api/mtn-momo/webhook',
  MTN_MOMO_WEBHOOK_SECRET: 'unit-test-webhook-secret',
};

const basic = (user: string, key: string) =>
  `Basic ${Buffer.from(`${user}:${key}`).toString('base64')}`;

describe('MtnMomoService', () => {
  let db: {
    logPaymentRequest: jest.Mock;
    getPaymentRequestByTransactionId: jest.Mock;
    completePendingPaymentRequest: jest.Mock;
    getPendingPaymentRequests: jest.Mock;
  };
  const logger = {
    info: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  async function build(
    env: Record<string, string> = BASE_ENV
  ): Promise<MtnMomoService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MtnMomoService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => env[key]) },
        },
        { provide: MtnMomoDatabaseService, useValue: db },
        { provide: WINSTON_MODULE_PROVIDER, useValue: logger },
      ],
    }).compile();
    return module.get(MtnMomoService);
  }

  const tokenReply = (token: string) => ({
    data: { access_token: token, expires_in: 3600 },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    db = {
      logPaymentRequest: jest.fn().mockResolvedValue(undefined),
      getPaymentRequestByTransactionId: jest.fn(),
      completePendingPaymentRequest: jest.fn().mockResolvedValue(true),
      getPendingPaymentRequests: jest.fn().mockResolvedValue([]),
    };
  });

  describe('per-product credentials', () => {
    it('uses each product its own API user, API key and subscription key for the token', async () => {
      const service = await build();
      http.post.mockResolvedValue(tokenReply('tok'));
      http.get.mockResolvedValue({
        data: { availableBalance: '1', currency: 'EUR' },
      });

      await service.getAccountBalance('collection');
      await service.getAccountBalance('disbursement');

      const [colUrl, , colCfg] = http.post.mock.calls[0];
      const [disUrl, , disCfg] = http.post.mock.calls[1];
      expect(colUrl).toBe('/collection/token/');
      expect(colCfg.headers.Authorization).toBe(basic('col-user', 'col-key'));
      expect(colCfg.headers['Ocp-Apim-Subscription-Key']).toBe('col-sub');
      expect(disUrl).toBe('/disbursement/token/');
      expect(disCfg.headers.Authorization).toBe(basic('dis-user', 'dis-key'));
      expect(disCfg.headers['Ocp-Apim-Subscription-Key']).toBe('dis-sub');
    });

    it('sends the product subscription key on transfer and balance calls', async () => {
      const service = await build();
      http.post.mockResolvedValue(tokenReply('tok'));

      await service.transfer({
        amount: '10',
        currency: 'EUR',
        externalId: 'x1',
        payee: { partyIdType: 'MSISDN', partyId: '46733123450' },
        payerMessage: 'm',
        payeeNote: 'n',
      });

      const transferCall = http.post.mock.calls.find(
        ([url]) => url === '/disbursement/v1_0/transfer'
      );
      expect(transferCall?.[2].headers['Ocp-Apim-Subscription-Key']).toBe(
        'dis-sub'
      );
    });

    it('does not fall back to the legacy single credential set for disbursement', async () => {
      const service = await build({
        MTN_MOMO_SUBSCRIPTION_KEY: 'legacy-sub',
        MTN_MOMO_API_USER_ID: 'legacy-user',
        MTN_MOMO_API_KEY: 'legacy-key',
      });

      const result = await service.transfer({
        amount: '10',
        currency: 'EUR',
        externalId: 'x1',
        payee: { partyIdType: 'MSISDN', partyId: '46733123450' },
        payerMessage: 'm',
        payeeNote: 'n',
      });

      expect(result.status).toBe(false);
      expect(result.error).toContain('MTN_MOMO_DISBURSEMENT_API_USER_ID');
      expect(result.error).not.toContain('legacy-key');
      expect(http.post).not.toHaveBeenCalled();
    });

    it('keeps the legacy single credential set working for collection', async () => {
      const service = await build({
        MTN_MOMO_SUBSCRIPTION_KEY: 'legacy-sub',
        MTN_MOMO_API_USER_ID: 'legacy-user',
        MTN_MOMO_API_KEY: 'legacy-key',
      });
      http.post.mockResolvedValue(tokenReply('tok'));
      http.get.mockResolvedValue({
        data: { availableBalance: '1', currency: 'EUR' },
      });

      const result = await service.getAccountBalance('collection');

      expect(result.status).toBe(true);
      expect(http.post.mock.calls[0][2].headers.Authorization).toBe(
        basic('legacy-user', 'legacy-key')
      );
    });

    it('caches the token per product until it nears expiry', async () => {
      const service = await build();
      http.post.mockResolvedValue(tokenReply('tok'));
      http.get.mockResolvedValue({
        data: { availableBalance: '1', currency: 'EUR' },
      });

      await service.getAccountBalance('collection');
      await service.getAccountBalance('collection');

      const tokenCalls = http.post.mock.calls.filter(
        ([u]) => u === '/collection/token/'
      );
      expect(tokenCalls).toHaveLength(1);
    });

    it('rejects an unknown product type instead of building a URL from it', async () => {
      const service = await build();
      const result = await service.getAccountBalance('../admin' as never);
      expect(result.status).toBe(false);
      expect(http.post).not.toHaveBeenCalled();
      expect(http.get).not.toHaveBeenCalled();
    });
  });

  describe('base URL and target environment', () => {
    it('keeps sandbox and legacy production defaults', async () => {
      await build();
      expect(createAxios).not.toHaveBeenCalled(); // lazy
      const service = await build();
      http.post.mockResolvedValue(tokenReply('t'));
      http.get.mockResolvedValue({ data: {} });
      await service.getAccountBalance('collection');
      expect(createAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://sandbox.momodeveloper.mtn.com',
        })
      );
    });

    it('sends target environment and base URL independently (mtncameroon)', async () => {
      const service = await build({
        ...BASE_ENV,
        MTN_MOMO_TARGET_ENVIRONMENT: 'mtncameroon',
        MTN_MOMO_BASE_URL: 'https://momoapi.momo.africa/',
      });
      http.post.mockResolvedValue(tokenReply('t'));
      http.get.mockResolvedValue({ data: {} });

      await service.getAccountBalance('collection');

      expect(createAxios).toHaveBeenCalledWith(
        expect.objectContaining({ baseURL: 'https://momoapi.momo.africa' })
      );
      expect(http.get.mock.calls[0][1].headers['X-Target-Environment']).toBe(
        'mtncameroon'
      );
    });

    it('does not guess a host for an unknown target environment', async () => {
      const service = await build({
        ...BASE_ENV,
        MTN_MOMO_TARGET_ENVIRONMENT: 'mtncameroon',
      });
      const result = await service.getAccountBalance('collection');
      expect(result.status).toBe(false);
      expect(result.error).toContain('MTN_MOMO_BASE_URL');
      expect(http.post).not.toHaveBeenCalled();
    });
  });

  describe('requestToPay', () => {
    const request = {
      amount: '10',
      currency: 'EUR',
      externalId: 'order-1',
      payer: { partyIdType: 'MSISDN' as const, partyId: '56733123453' },
      payerMessage: 'pay',
      payeeNote: 'thanks',
    };

    function requestToPayHeaders() {
      const call = http.post.mock.calls.find(
        ([url]) => url === '/collection/v1_0/requesttopay'
      );
      return call?.[2].headers as Record<string, string>;
    }

    it('omits X-Callback-Url when MTN_MOMO_CALLBACK_URL is unset', async () => {
      const { MTN_MOMO_CALLBACK_URL: _omit, ...env } = BASE_ENV;
      const service = await build(env);
      http.post.mockResolvedValue(tokenReply('t'));

      const result = await service.requestToPay(request, 'user-1');

      expect(result.status).toBe(true);
      expect(requestToPayHeaders()).not.toHaveProperty('X-Callback-Url');
    });

    it('omits X-Callback-Url when MTN_MOMO_CALLBACK_URL is blank', async () => {
      const service = await build({
        ...BASE_ENV,
        MTN_MOMO_CALLBACK_URL: '   ',
      });
      http.post.mockResolvedValue(tokenReply('t'));
      await service.requestToPay(request, 'user-1');
      expect(requestToPayHeaders()).not.toHaveProperty('X-Callback-Url');
    });

    it('omits X-Callback-Url when no webhook secret is configured', async () => {
      const { MTN_MOMO_WEBHOOK_SECRET: _omit, ...env } = BASE_ENV;
      const service = await build(env);
      http.post.mockResolvedValue(tokenReply('t'));
      await service.requestToPay(request, 'user-1');
      expect(requestToPayHeaders()).not.toHaveProperty('X-Callback-Url');
    });

    it('sends a callback URL bound to the reference id with a signed token', async () => {
      const service = await build();
      http.post.mockResolvedValue(tokenReply('t'));

      const result = await service.requestToPay(request, 'user-1');

      const header = requestToPayHeaders()['X-Callback-Url'];
      const url = new URL(header);
      expect(url.origin + url.pathname).toBe(
        'https://rendasua.com/dev/api/mtn-momo/webhook'
      );
      expect(url.searchParams.get('ref')).toBe(result.financialTransactionId);
      expect(
        service.verifyWebhookToken(
          url.searchParams.get('ref'),
          url.searchParams.get('token')
        )
      ).toBe(true);
      expect(requestToPayHeaders()['X-Reference-Id']).toBe(
        result.financialTransactionId
      );
    });

    it('defaults the currency from MTN_MOMO_CURRENCY and logs the request', async () => {
      const service = await build({
        ...BASE_ENV,
        MTN_MOMO_TARGET_ENVIRONMENT: 'sandbox',
        MTN_MOMO_CURRENCY: 'XAF',
      });
      http.post.mockResolvedValue(tokenReply('t'));

      const result = await service.requestToPay(
        { ...request, currency: '' as string, amount: '1500' },
        'user-1'
      );

      expect(result.currency).toBe('XAF');
      expect(db.logPaymentRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: 'XAF',
          amount: 1500,
          status: 'PENDING',
        })
      );
    });

    it('defaults to EUR in sandbox and XAF elsewhere', async () => {
      expect((await build()).getDefaultCurrency()).toBe('EUR');
      expect(
        (
          await build({
            ...BASE_ENV,
            MTN_MOMO_TARGET_ENVIRONMENT: 'mtncameroon',
            MTN_MOMO_BASE_URL: 'https://momoapi.momo.africa',
          })
        ).getDefaultCurrency()
      ).toBe('XAF');
    });

    it('rejects a fractional XAF amount without calling MTN', async () => {
      const service = await build({ ...BASE_ENV, MTN_MOMO_CURRENCY: 'XAF' });
      const result = await service.requestToPay(
        { ...request, currency: 'XAF', amount: '10.5' },
        'user-1'
      );
      expect(result.status).toBe(false);
      expect(result.error).toContain('whole number');
      expect(http.post).not.toHaveBeenCalled();
    });
  });

  describe('verifyWebhookToken', () => {
    it('accepts the signed token and rejects wrong, foreign and malformed ones', async () => {
      const service = await build();
      const good = signMtnWebhookToken('unit-test-webhook-secret', REF);
      const other = '9b2d8a10-1111-4c0a-9a53-0e1c8f7a2b22';
      expect(service.verifyWebhookToken(REF, good)).toBe(true);
      expect(service.verifyWebhookToken(other, good)).toBe(false);
      expect(
        service.verifyWebhookToken(
          REF,
          good.replace(/.$/, '0') === good
            ? 'f'.repeat(64)
            : good.replace(/.$/, '0')
        )
      ).toBe(false);
      expect(service.verifyWebhookToken(REF, 'short')).toBe(false);
      expect(service.verifyWebhookToken(REF, undefined)).toBe(false);
      expect(service.verifyWebhookToken(undefined, good)).toBe(false);
      expect(service.verifyWebhookToken('not-a-uuid', good)).toBe(false);
    });

    it('rejects everything when no webhook secret is configured', async () => {
      const { MTN_MOMO_WEBHOOK_SECRET: _omit, ...env } = BASE_ENV;
      const service = await build(env);
      const token = signMtnWebhookToken('', REF);
      expect(service.verifyWebhookToken(REF, token)).toBe(false);
    });
  });

  describe('callback and polling reconciliation', () => {
    const pendingRow = {
      status: 'PENDING',
      external_id: 'order-1',
      amount: '10.00',
    };

    beforeEach(() => {
      http.post.mockResolvedValue(tokenReply('t'));
    });

    it('re-reads the status from MTN and ignores the claimed callback status', async () => {
      const service = await build();
      db.getPaymentRequestByTransactionId.mockResolvedValue(pendingRow);
      http.get.mockResolvedValue({
        data: {
          status: 'FAILED',
          reason: 'APPROVAL_REJECTED',
          externalId: 'order-1',
        },
      });

      const outcome = await service.handleCallback(
        { status: 'SUCCESSFUL' },
        REF
      );

      expect(outcome).toBe('updated');
      expect(http.get.mock.calls[0][0]).toBe(
        `/collection/v1_0/requesttopay/${REF}`
      );
      expect(db.completePendingPaymentRequest).toHaveBeenCalledWith(
        REF,
        'FAILED'
      );
    });

    it('marks a SUCCESSFUL request', async () => {
      const service = await build();
      db.getPaymentRequestByTransactionId.mockResolvedValue(pendingRow);
      http.get.mockResolvedValue({
        data: {
          status: 'SUCCESSFUL',
          externalId: 'order-1',
          amount: '10',
          currency: 'EUR',
        },
      });

      expect(await service.reconcilePaymentRequest(REF)).toBe('updated');
      expect(db.completePendingPaymentRequest).toHaveBeenCalledWith(
        REF,
        'SUCCESSFUL'
      );
    });

    it('leaves a still-PENDING request alone', async () => {
      const service = await build();
      db.getPaymentRequestByTransactionId.mockResolvedValue(pendingRow);
      http.get.mockResolvedValue({ data: { status: 'PENDING' } });

      expect(await service.reconcilePaymentRequest(REF)).toBe('still_pending');
      expect(db.completePendingPaymentRequest).not.toHaveBeenCalled();
    });

    it('does not call MTN again for a request that is already final', async () => {
      const service = await build();
      db.getPaymentRequestByTransactionId.mockResolvedValue({
        ...pendingRow,
        status: 'SUCCESSFUL',
      });

      expect(await service.reconcilePaymentRequest(REF)).toBe('already_final');
      expect(http.get).not.toHaveBeenCalled();
    });

    it('reports a lost race when the guarded update moves nothing', async () => {
      const service = await build();
      db.getPaymentRequestByTransactionId.mockResolvedValue(pendingRow);
      db.completePendingPaymentRequest.mockResolvedValue(false);
      http.get.mockResolvedValue({
        data: { status: 'SUCCESSFUL', externalId: 'order-1', amount: '10' },
      });

      expect(await service.reconcilePaymentRequest(REF)).toBe('already_final');
    });

    it('ignores references we never created', async () => {
      const service = await build();
      db.getPaymentRequestByTransactionId.mockResolvedValue(null);
      expect(await service.reconcilePaymentRequest(REF)).toBe(
        'unknown_reference'
      );
      expect(await service.reconcilePaymentRequest('nope')).toBe(
        'unknown_reference'
      );
      expect(http.get).not.toHaveBeenCalled();
    });

    it('never applies a status whose external id or amount differs from the stored request', async () => {
      const service = await build();
      db.getPaymentRequestByTransactionId.mockResolvedValue(pendingRow);

      http.get.mockResolvedValueOnce({
        data: { status: 'SUCCESSFUL', externalId: 'other', amount: '10' },
      });
      expect(await service.reconcilePaymentRequest(REF)).toBe('mismatch');

      http.get.mockResolvedValueOnce({
        data: { status: 'SUCCESSFUL', externalId: 'order-1', amount: '999' },
      });
      expect(await service.reconcilePaymentRequest(REF)).toBe('mismatch');
      expect(db.completePendingPaymentRequest).not.toHaveBeenCalled();
    });

    it('treats an unknown MTN status as still pending', async () => {
      const service = await build();
      db.getPaymentRequestByTransactionId.mockResolvedValue(pendingRow);
      http.get.mockResolvedValue({ data: { status: 'WEIRD' } });
      expect(await service.reconcilePaymentRequest(REF)).toBe('still_pending');
    });

    it('polling settles pending requests, counts errors and keeps going', async () => {
      const service = await build();
      const REF2 = '7a4b9c10-2222-4c0a-9a53-0e1c8f7a2b33';
      db.getPendingPaymentRequests.mockResolvedValue([
        { transaction_id: REF, external_id: 'order-1' },
        { transaction_id: REF2, external_id: 'order-2' },
      ]);
      db.getPaymentRequestByTransactionId
        .mockResolvedValueOnce(pendingRow)
        .mockResolvedValueOnce({ ...pendingRow, external_id: 'order-2' });
      http.get
        .mockRejectedValueOnce(new Error('network'))
        .mockResolvedValueOnce({
          data: { status: 'SUCCESSFUL', externalId: 'order-2', amount: '10' },
        });

      const result = await service.reconcilePendingPaymentRequests();

      expect(result).toEqual({ checked: 2, updated: 1, errors: 1 });
      expect(db.completePendingPaymentRequest).toHaveBeenCalledWith(
        REF2,
        'SUCCESSFUL'
      );
    });

    it('polling does nothing when collection credentials are not configured', async () => {
      const service = await build({ MTN_MOMO_TARGET_ENVIRONMENT: 'sandbox' });
      expect(await service.reconcilePendingPaymentRequests()).toEqual({
        checked: 0,
        updated: 0,
        errors: 0,
      });
      expect(db.getPendingPaymentRequests).not.toHaveBeenCalled();
    });

    it('polls rows older than the minimum age and does not count a final row as updated', async () => {
      jest.useFakeTimers({ now: new Date('2026-10-28T10:00:00.000Z') });
      try {
        const service = await build();
        db.getPendingPaymentRequests.mockResolvedValue([
          { transaction_id: REF, external_id: 'order-1' },
        ]);
        db.getPaymentRequestByTransactionId.mockResolvedValue({
          ...pendingRow,
          status: 'SUCCESSFUL',
        });
        await expect(service.reconcilePendingPaymentRequests()).resolves.toEqual({
          checked: 1,
          updated: 0,
          errors: 0,
        });
        expect(db.getPendingPaymentRequests).toHaveBeenCalledWith(
          new Date('2026-10-28T09:59:00.000Z'),
          50
        );
        await service.reconcilePendingPaymentRequests({
          minAgeSeconds: 120,
          limit: 3,
        });
        expect(db.getPendingPaymentRequests).toHaveBeenLastCalledWith(
          new Date('2026-10-28T09:58:00.000Z'),
          3
        );
        expect(db.completePendingPaymentRequest).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });

    it('rejects a non-numeric success amount and still closes a failed one', async () => {
      const service = await build();
      db.getPaymentRequestByTransactionId.mockResolvedValue(pendingRow);
      http.get.mockResolvedValueOnce({
        data: { status: 'SUCCESSFUL', externalId: 'order-1', amount: '10.0abc' },
      });
      expect(await service.reconcilePaymentRequest(REF)).toBe('mismatch');
      expect(db.completePendingPaymentRequest).not.toHaveBeenCalled();

      http.get.mockResolvedValueOnce({
        data: {
          status: 'FAILED',
          externalId: 'order-1',
          amount: '1',
          reason: 'APPROVAL_REJECTED',
        },
      });
      expect(await service.reconcilePaymentRequest(REF)).toBe('updated');
      expect(db.completePendingPaymentRequest).toHaveBeenCalledWith(REF, 'FAILED');
    });
  });

  it('never logs credential or token values', async () => {
    const service = await build();
    http.post.mockRejectedValue(
      new Error('Request failed with status code 401')
    );
    await service.getAccountBalance('disbursement');
    const logged = JSON.stringify([
      logger.info.mock.calls,
      logger.warn.mock.calls,
      logger.error.mock.calls,
    ]);
    for (const secret of [
      'dis-key',
      'dis-sub',
      'col-key',
      'col-sub',
      'unit-test-webhook-secret',
    ]) {
      expect(logged).not.toContain(secret);
    }
  });
});
