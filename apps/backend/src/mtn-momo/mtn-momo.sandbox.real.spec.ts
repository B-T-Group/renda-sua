/**
 * Opt-in end-to-end test against the MTN MoMo SANDBOX (https://sandbox.momodeveloper.mtn.com).
 *
 * Skipped unless MTN_MOMO_SANDBOX_E2E=true, so CI and local `nx test` never touch the
 * network. It drives the real MtnMomoService (real HTTP, in-memory payment-request
 * store). Credentials come from the environment only, per product:
 *
 *   MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY / _API_USER_ID / _API_KEY
 *   MTN_MOMO_DISBURSEMENT_SUBSCRIPTION_KEY / _API_USER_ID / _API_KEY
 *   MTN_MOMO_CALLBACK_URL (host must equal the API user's providerCallbackHost)
 *   MTN_MOMO_WEBHOOK_SECRET (any value; signs the callback token)
 *
 * Run:  MTN_MOMO_SANDBOX_E2E=true npx nx test backend --testPathPattern=mtn-momo.sandbox
 * (see README "Sandbox end-to-end test"). Sandbox test numbers:
 *   56733123453 success | 46733123451 rejected | 46733123452 expired | 46733123453 pending
 */
import { ConfigService } from '@nestjs/config';
import { MtnMomoDatabaseService } from './mtn-momo-database.service';
import { MtnMomoService } from './mtn-momo.service';

const RUN = process.env.MTN_MOMO_SANDBOX_E2E === 'true';
const suite = RUN ? describe : describe.skip;

const SUCCESS = '56733123453';
const REJECTED = '46733123451';
const EXPIRED = '46733123452';
const PENDING = '46733123453';

type Row = {
  transaction_id: string;
  external_id: string;
  amount: number;
  currency: string;
  status: string;
};

class InMemoryPaymentRequests {
  rows = new Map<string, Row>();
  async logPaymentRequest(log: {
    transactionId: string;
    externalId: string;
    amount: number;
    currency: string;
    status: string;
  }) {
    this.rows.set(log.transactionId, {
      transaction_id: log.transactionId,
      external_id: log.externalId,
      amount: log.amount,
      currency: log.currency,
      status: log.status,
    });
  }
  async getPaymentRequestByTransactionId(id: string) {
    return this.rows.get(id) ?? null;
  }
  async completePendingPaymentRequest(id: string, status: string) {
    const row = this.rows.get(id);
    if (!row || row.status !== 'PENDING') return false;
    row.status = status;
    return true;
  }
  async getPendingPaymentRequests() {
    return [...this.rows.values()].filter((r) => r.status === 'PENDING');
  }
}

const logger = {
  info: () => undefined,
  log: () => undefined,
  warn: () => undefined,
  error: () => undefined,
} as never;

function buildService(overrides: Record<string, string | undefined> = {}) {
  const store = new InMemoryPaymentRequests();
  const env = { ...process.env, ...overrides };
  const service = new MtnMomoService(
    { get: (key: string) => env[key] } as unknown as ConfigService,
    store as unknown as MtnMomoDatabaseService,
    logger
  );
  return { service, store };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function settle(
  service: MtnMomoService,
  referenceId: string,
  attempts = 10
): Promise<string> {
  for (let i = 0; i < attempts; i += 1) {
    const outcome = await service.reconcilePaymentRequest(referenceId);
    if (outcome !== 'still_pending') return outcome;
    await sleep(3000);
  }
  return 'still_pending';
}

/**
 * The sandbox balance endpoint intermittently answers 500/503 (observed with plain curl
 * too), so retry before asserting. Token acquisition is still exercised on every try.
 */
async function balanceWithRetry(
  service: MtnMomoService,
  product: 'collection' | 'disbursement'
) {
  let last = await service.getAccountBalance(product);
  for (let i = 0; i < 5 && !last.status; i += 1) {
    await sleep(2000);
    last = await service.getAccountBalance(product);
  }
  return last;
}

suite('MTN MoMo sandbox (opt-in: MTN_MOMO_SANDBOX_E2E=true)', () => {
  jest.setTimeout(120_000);

  const collect = (service: MtnMomoService, msisdn: string) =>
    service.requestToPay(
      {
        amount: '10',
        currency: 'EUR',
        externalId: `rs-e2e-${Date.now()}`,
        payer: { partyIdType: 'MSISDN', partyId: msisdn },
        payerMessage: 'Rendasua sandbox test',
        payeeNote: 'Rendasua sandbox test',
      },
      '00000000-0000-4000-8000-000000000000'
    );

  const payout = (service: MtnMomoService, msisdn: string) =>
    service.transfer({
      amount: '10',
      currency: 'EUR',
      externalId: `rs-e2e-${Date.now()}`,
      payee: { partyIdType: 'MSISDN', partyId: msisdn },
      payerMessage: 'Rendasua sandbox test',
      payeeNote: 'Rendasua sandbox test',
    });

  async function transferStatus(service: MtnMomoService, id: string) {
    for (let i = 0; i < 10; i += 1) {
      const res = await service.transferDeliveryNotification(id);
      if (res.statusCode && res.statusCode !== 'PENDING') return res;
      await sleep(3000);
    }
    return service.transferDeliveryNotification(id);
  }

  it('collection: token + balance with the collection credentials', async () => {
    const { service } = buildService();
    const balance = await balanceWithRetry(service, 'collection');
    expect(balance.error).toBeUndefined();
    expect(balance.status).toBe(true);
  });

  it('disbursement: token + balance with the disbursement credentials', async () => {
    const { service } = buildService();
    const balance = await balanceWithRetry(service, 'disbursement');
    expect(balance.error).toBeUndefined();
    expect(balance.status).toBe(true);
  });

  it('collection: success number settles to SUCCESSFUL', async () => {
    const { service, store } = buildService();
    const res = await collect(service, SUCCESS);
    expect(res.status).toBe(true);
    const id = res.financialTransactionId as string;
    expect(store.rows.get(id)?.status).toBe('PENDING');
    expect(await settle(service, id)).toBe('updated');
    expect(store.rows.get(id)?.status).toBe('SUCCESSFUL');
  });

  it('collection: rejected number settles to FAILED', async () => {
    const { service, store } = buildService();
    const res = await collect(service, REJECTED);
    const id = res.financialTransactionId as string;
    expect(await settle(service, id)).toBe('updated');
    expect(store.rows.get(id)?.status).toBe('FAILED');
  });

  it('collection: expired number settles to FAILED', async () => {
    const { service, store } = buildService();
    const res = await collect(service, EXPIRED);
    const id = res.financialTransactionId as string;
    expect(await settle(service, id)).toBe('updated');
    expect(store.rows.get(id)?.status).toBe('FAILED');
  });

  it('collection: pending number stays PENDING (polling must not settle it)', async () => {
    const { service, store } = buildService();
    const res = await collect(service, PENDING);
    const id = res.financialTransactionId as string;
    expect(await settle(service, id, 2)).toBe('still_pending');
    expect(store.rows.get(id)?.status).toBe('PENDING');
  });

  it('collection: works with and without X-Callback-Url', async () => {
    const withCb = buildService();
    expect(process.env.MTN_MOMO_CALLBACK_URL).toBeTruthy();
    expect((await collect(withCb.service, SUCCESS)).status).toBe(true);

    const withoutCb = buildService({ MTN_MOMO_CALLBACK_URL: '' });
    expect((await collect(withoutCb.service, SUCCESS)).status).toBe(true);
  });

  it('disbursement: success number reaches SUCCESSFUL', async () => {
    const { service } = buildService();
    const res = await payout(service, SUCCESS);
    expect(res.error).toBeUndefined();
    expect(res.status).toBe(true);
    const final = await transferStatus(
      service,
      res.financialTransactionId as string
    );
    expect(final.statusCode).toBe('SUCCESSFUL');
  });

  it('disbursement: rejected number reaches FAILED', async () => {
    const { service } = buildService();
    const res = await payout(service, REJECTED);
    expect(res.status).toBe(true);
    const final = await transferStatus(
      service,
      res.financialTransactionId as string
    );
    expect(final.statusCode).toBe('FAILED');
  });
});
