import { HttpException } from '@nestjs/common';
import { RentalCommissionService } from '../rental-commission/rental-commission.service';
import { RentalsService } from './rentals.service';

interface Tx {
  accountId: string;
  amount: number;
  transactionType: string;
  idempotencyKey?: string;
}

function build() {
  const txs: Tx[] = [];
  const mutations: Array<{ query: string; vars: any }> = [];
  const keys = new Map<string, any>();
  const accounts = {
    registerTransaction: jest.fn(async (tx: Tx) => {
      if (tx.idempotencyKey && keys.has(tx.idempotencyKey)) return { success: true, alreadyExists: true };
      if (tx.idempotencyKey) keys.set(tx.idempotencyKey, tx);
      txs.push(tx);
      return { success: true, transactionId: `t${txs.length}` };
    }),
    registerReleaseIfNotExists: jest.fn().mockResolvedValue({ success: true }),
  };
  const hasura = {
    getRendasuaHQUser: jest.fn().mockResolvedValue({ id: 'hq-user' }),
    getAccount: jest.fn().mockResolvedValue({ id: 'hq-acc' }),
    executeMutation: jest.fn(async (query: string, vars: any) => {
      mutations.push({ query, vars });
      return {};
    }),
    executeQuery: jest.fn(),
  };
  const commission = new RentalCommissionService(hasura as any, {} as any, accounts as any, {} as any);
  const svc: any = Object.create(RentalsService.prototype);
  svc.commission = commission;
  svc.accountsService = accounts;
  svc.hasuraSystemService = {
    ...hasura,
    getAccount: jest.fn().mockResolvedValue({ id: 'client-acc' }),
    ensureAccountForBusinessLocation: jest.fn().mockResolvedValue({ id: 'biz-acc' }),
  };
  svc.getHold = jest.fn().mockResolvedValue({ status: 'active', client_hold_amount: 10000, ledger_attempt_id: 'a1' });
  svc.rentalSettlementAccounts = jest.fn().mockResolvedValue({ clientAccountId: 'client-acc', businessAccountId: 'biz-acc' });
  return { svc, txs, mutations, hasura };
}

const quoted = {
  id: 'b1',
  currency: 'XAF',
  total_amount: 10000,
  commission_status: 'quoted',
  commission_rate_bps: 1500,
  business: { user_id: 'biz-user' },
  client: { user_id: 'client-user' },
  rental_location_listing: { business_location_id: 'loc' },
};

describe('rental commission at settlement', () => {
  it('wallet: renter pays the full total, merchant gets 85%, HQ gets 15%', async () => {
    const { svc, txs } = build();
    await svc.settleBooking(quoted);
    expect(txs.map((t) => [t.accountId, t.transactionType, t.amount, t.idempotencyKey])).toEqual([
      ['client-acc', 'payment', 10000, 'rental:b1:contract:payment'],
      ['biz-acc', 'deposit', 8500, 'rental:b1:contract:proceeds'],
      ['hq-acc', 'deposit', 1500, 'rental:b1:contract:commission'],
    ]);
  });

  it('records both audit rows and marks the booking earned', async () => {
    const { svc, mutations } = build();
    await svc.settleBooking(quoted);
    const payouts = mutations.filter((m) => m.vars.object?.rental_booking_id).map((m) => m.vars.object);
    expect(payouts.map((p) => [p.commission_type, p.recipient_type, p.amount, p.commission_rate_bps])).toEqual([
      ['rental_commission', 'rendasua', 1500, 1500],
      ['rental_merchant_payout', 'business', 8500, 1500],
    ]);
    const status = mutations.find((m) => m.vars.set?.commission_status === 'earned');
    expect(status?.vars.from).toEqual(['quoted']);
    expect(status?.vars.set.commission_earned_amount).toBe(1500);
  });

  it('replaying the settlement posts nothing twice', async () => {
    const { svc, txs } = build();
    await svc.settleBooking(quoted);
    await svc.settleBooking(quoted);
    expect(txs).toHaveLength(3);
  });

  it('legacy bookings keep the single full-amount credit and no commission leg', async () => {
    const { svc, txs } = build();
    await svc.settleBooking({ ...quoted, commission_status: 'not_applicable', commission_rate_bps: null });
    expect(txs.map((t) => [t.accountId, t.amount])).toEqual([
      ['client-acc', 10000],
      ['biz-acc', 10000],
    ]);
  });

  it('uses the frozen rate, not today default, when the settlement runs later', async () => {
    const { svc, txs } = build();
    await svc.settleBooking({ ...quoted, commission_rate_bps: 1000 });
    expect(txs.find((t) => t.accountId === 'hq-acc')?.amount).toBe(1000);
    expect(txs.find((t) => t.accountId === 'biz-acc')?.amount).toBe(9000);
  });

  it('rounds XAF half-up and keeps the legs summing to the total', async () => {
    const { svc, txs } = build();
    await svc.settleBooking({ ...quoted, total_amount: 150 });
    const merchant = txs.find((t) => t.accountId === 'biz-acc')!.amount;
    const hq = txs.find((t) => t.accountId === 'hq-acc')!.amount;
    expect([merchant, hq]).toEqual([127, 23]);
  });

  it('stripe capture: commission comes out of the captured contract; overtime stays 100% with the merchant', async () => {
    const { svc, txs } = build();
    await svc.registerRentalProceedsLedger(quoted, 10000, 'Stripe capture', svc.commission.commissionFor(quoted, 10000));
    await svc.registerRentalProceedsLedger(quoted, 2000, 'Overtime', 0);
    expect(txs.filter((t) => t.accountId !== 'client-acc').map((t) => [t.accountId, t.amount, t.idempotencyKey])).toEqual([
      ['biz-acc', 8500, 'rental:b1:stripe-capture:proceeds'],
      ['hq-acc', 1500, 'rental:b1:stripe-capture:commission'],
      ['biz-acc', 2000, 'rental:b1:overtime:proceeds'],
    ]);
  });

  it('never withholds more than was collected', () => {
    const { svc } = build();
    expect(svc.commission.commissionFor(quoted, 10)).toBe(10);
  });

  it('fails the settlement when the HQ commission leg fails so the completion rolls back', async () => {
    const { svc, hasura } = build();
    hasura.getRendasuaHQUser.mockResolvedValue(null);
    await expect(svc.settleBooking(quoted)).rejects.toBeInstanceOf(HttpException);
  });
});
