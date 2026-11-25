import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Payout } from 'fedapay';
import { FedaPayService, resetFedapayListSpend } from '../../mobile-payments/providers/fedapay.service';

jest.mock('fedapay', () => ({
  FedaPay: { setApiKey: jest.fn(), setEnvironment: jest.fn(), getApiKey: jest.fn(), getEnvironment: jest.fn() },
  Transaction: { create: jest.fn(), retrieve: jest.fn() },
  Payout: { create: jest.fn(), retrieve: jest.fn(), all: jest.fn() },
  Webhook: { constructEvent: jest.fn() },
}));

type Channel = 'moov_tg' | 'togocel';
type Kind = 'clean' | 'kill' | 'outage' | 'http502' | 'lag' | 'fourxx' | 'failed' | 'canceled' | 'killOutage' | 'retrieveDown';
type ListOp = 'ok' | 'down';
type CreateOp = 'ok' | '502' | 'timeout' | '4xx' | 'lag';

interface Step {
  lists: ListOp[];
  create: CreateOp;
  kill: boolean;
  reveal: boolean;
  retrieve: 'ok' | 'down';
  marked: boolean;
  trustEmpty: boolean;
}

interface Row {
  id: number;
  status: string;
  externalId: string;
  sends: number;
}

interface Booking {
  n: number;
  kind: Kind;
  channel: Channel;
  status: 'refund_pending' | 'failed' | 'refunded';
  ref: string | null;
  deposits: number;
  sendsTried: number;
  claim: boolean;
}

const KINDS: Kind[] = ['clean', 'kill', 'outage', 'http502', 'lag', 'fourxx', 'failed', 'canceled', 'killOutage', 'retrieveDown'];
const ROUNDS = 12;
const WORKERS = 8;
const store = {
  rows: [] as Row[],
  seq: 9000,
  hidden: new Set<number>(),
  plans: new Map<string, Step>(),
};

function externalId(booking: Booking): string {
  return `rental-decline-storm-${booking.n}`;
}

function stepFor(kind: Kind, attempt: number): Step {
  const ok = {
    lists: ['ok'] as ListOp[],
    create: 'ok' as CreateOp,
    kill: false,
    reveal: false,
    retrieve: 'ok' as const,
    marked: attempt > 0,
    trustEmpty: true,
  };
  if (kind === 'outage' && attempt === 0) return { ...ok, lists: ['down'] };
  if (kind === 'kill' && attempt === 0) return { ...ok, kill: true };
  if (kind === 'http502' && attempt === 0) return { ...ok, lists: ['ok', 'down'], create: '502' };
  if (kind === 'lag' && attempt === 0) return { ...ok, lists: ['ok', 'ok'], create: 'lag' };
  if (kind === 'lag' && attempt === 1) return { ...ok, trustEmpty: false };
  if (kind === 'lag' && attempt > 1) return { ...ok, reveal: true };
  if (kind === 'fourxx') return { ...ok, lists: ['ok', 'ok'], create: '4xx' };
  if (kind === 'killOutage' && attempt === 0) return { ...ok, kill: true };
  if (kind === 'killOutage' && attempt === 1) return { ...ok, lists: ['down'] };
  if (kind === 'retrieveDown' && attempt === 0) return { ...ok, lists: ['ok', 'ok'], create: '502', retrieve: 'down' };
  return ok;
}

function bookings(): Booking[] {
  return KINDS.flatMap((kind, kindIndex) => [0, 1, 2].map((copy) => ({
    n: kindIndex * 3 + copy,
    kind,
    channel: (kindIndex * 3 + copy) % 2 === 0 ? 'togocel' : 'moov_tg',
    status: 'refund_pending' as const,
    ref: null,
    deposits: 0,
    sendsTried: 0,
    claim: false,
  })));
}

function seedTerminal(booking: Booking): void {
  if (booking.kind !== 'failed' && booking.kind !== 'canceled') return;
  store.rows.push({ id: ++store.seq, status: booking.kind, externalId: externalId(booking), sends: 0 });
}

function listed(external: string) {
  return store.rows
    .filter((row) => row.externalId === external && !store.hidden.has(row.id))
    .map((row) => ({ id: row.id, status: row.status, custom_metadata: { externalId: row.externalId } }));
}

function sendRow(row: Row): Promise<void> {
  row.sends += 1;
  row.status = 'started';
  return Promise.resolve();
}

function createRow(external: string, step: Step): Row {
  const row = { id: ++store.seq, status: 'pending', externalId: external, sends: 0 };
  store.rows.push(row);
  if (step.create === 'lag') store.hidden.add(row.id);
  return row;
}

function throwCreate(step: Step): never {
  if (step.create === '4xx') throw Object.assign(new Error('422 invalid payee'), { status: 422 });
  if (step.create === '502') throw Object.assign(new Error('bad gateway'), { status: 502 });
  throw Object.assign(new Error('socket timeout'), { code: 'ETIMEDOUT' });
}

const blankStep: Step = {
  lists: [],
  create: '4xx',
  kill: false,
  reveal: false,
  retrieve: 'ok',
  marked: false,
  trustEmpty: true,
};

function wirePayouts(): void {
  (Payout.all as jest.Mock).mockImplementation(async (query: { 'custom_metadata.externalId': string }) => {
    const step = store.plans.get(query['custom_metadata.externalId']);
    if (step?.lists.shift() === 'down') throw new Error('lookup down');
    const payouts = listed(query['custom_metadata.externalId']);
    return {
      payouts,
      meta: { current_page: 1, total_pages: 1, next_page: null, per_page: 25, total_count: payouts.length },
    };
  });
  (Payout.retrieve as jest.Mock).mockImplementation(async (id: number) => {
    const row = store.rows.find((item) => item.id === id);
    if (!row) throw new Error('missing');
    if (store.plans.get(row.externalId)?.retrieve === 'down') throw new Error('retrieve down');
    return { id: row.id, status: row.status, sendNow: () => sendRow(row) };
  });
  (Payout.create as jest.Mock).mockImplementation(async (body: { custom_metadata: { externalId: string } }) => {
    const external = body.custom_metadata.externalId;
    const step = store.plans.get(external);
    if (!step || step.create === '4xx') throwCreate(step ?? blankStep);
    const row = createRow(external, step);
    if (step.create !== 'ok') throwCreate(step);
    return { id: row.id, status: row.status, sendNow: () => sendRow(row) };
  });
}

function reveal(external: string): void {
  store.rows.filter((row) => row.externalId === external).forEach((row) => store.hidden.delete(row.id));
}

function applyResult(booking: Booking, result: { success: boolean; ambiguous?: boolean; status?: string; transactionId?: string }, kill: boolean): void {
  booking.sendsTried += 1;
  if (kill) return;
  if (!result.success && !result.ambiguous) {
    booking.deposits += 1;
    booking.status = 'failed';
    if (result.transactionId) booking.ref = result.transactionId;
    return;
  }
  if (!result.transactionId) return;
  booking.ref = result.transactionId;
  if (result.status === 'started' || result.status === 'sent' || result.status === 'approved') booking.status = 'refunded';
}

function poll(booking: Booking): void {
  const row = store.rows.find((item) => String(item.id) === booking.ref);
  if (!row) return;
  if (row.status === 'started' || row.status === 'sent' || row.status === 'approved') booking.status = 'refunded';
  if (row.status !== 'failed' && row.status !== 'canceled') return;
  if (booking.status === 'refund_pending') booking.deposits += 1;
  booking.status = 'failed';
}

async function worker(service: FedaPayService, booking: Booking): Promise<void> {
  if (booking.status !== 'refund_pending' || booking.claim) return;
  booking.claim = true;
  try {
    if (booking.ref) return poll(booking);
    const step = stepFor(booking.kind, booking.sendsTried);
    if (step.reveal) reveal(externalId(booking));
    store.plans.set(externalId(booking), { ...step, lists: step.lists.slice() });
    const result = await service.withdraw({
      payee: '+22878123456',
      amount: 5000,
      externalId: externalId(booking),
      description: 'Decline refund',
      callback: 'https://test.com/callback',
      channel: booking.channel,
      markedResend: step.marked,
      trustEmptyList: step.trustEmpty,
      strictList: true,
    });
    applyResult(booking, result, step.kill);
  } finally {
    booking.claim = false;
  }
}

async function round(service: FedaPayService, rows: Booking[]): Promise<void> {
  await Promise.all(rows.map((booking) => Promise.all(
    Array.from({ length: WORKERS }, () => worker(service, booking))
  )));
}

function sent(external: string): number {
  return store.rows.filter((row) => row.externalId === external && row.sends > 0).length;
}

function summary(rows: Booking[]): string {
  const doublePaid = rows.filter((booking) => booking.deposits > 0 && sent(externalId(booking)) > 0).length;
  const orphans = store.rows.filter((row) => row.status === 'pending' && row.sends === 0).length;
  const extras = rows.filter((booking) => store.rows.filter((row) => row.externalId === externalId(booking)).length > 1).length;
  const failed = rows.filter((booking) => booking.status === 'failed').length;
  const refunded = rows.filter((booking) => booking.status === 'refunded').length;
  const pending = rows.filter((booking) => booking.status === 'refund_pending').length;
  const togocel = rows.filter((booking) => booking.channel === 'togocel').length;
  const moov = rows.filter((booking) => booking.channel === 'moov_tg').length;
  return `bookings=${rows.length} workers=${WORKERS} rounds=${ROUNDS} modes=togocel:${togocel},moov_tg:${moov} final=failed:${failed} refunded:${refunded} pending:${pending} doublePaid=${doublePaid} orphans=${orphans} extraPayouts=${extras}`;
}

describe('FedaPay decline storm', () => {
  let service: FedaPayService;

  beforeEach(async () => {
    store.rows = [];
    store.seq = 9000;
    store.hidden = new Set();
    store.plans = new Map();
    resetFedapayListSpend();
    const moduleRef = await Test.createTestingModule({
      providers: [
        FedaPayService,
        { provide: ConfigService, useValue: { get: (key: string) => (key === 'fedapay' ? { env: 'sandbox', secretKey: 'k', publicKey: 'p', webhookSecret: 'w', mock: false } : undefined) } },
      ],
    }).compile();
    service = moduleRef.get(FedaPayService);
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    wirePayouts();
  });

  it('credits nothing when a marked row lookup throws', async () => {
    (Payout.all as jest.Mock).mockRejectedValue(new Error('lookup down'));
    const booking = bookings()[0];
    const result = await service.withdraw({
      payee: '+22878123456',
      amount: 5000,
      externalId: externalId(booking),
      description: 'Decline refund',
      callback: 'https://test.com/callback',
      channel: booking.channel,
      strictList: true,
    });
    applyResult(booking, result, false);
    expect(result.ambiguous).toBe(true);
    expect(result.transactionId).toBeUndefined();
    expect(booking.deposits).toBe(0);
    expect(booking.status).toBe('refund_pending');
    expect(store.rows).toHaveLength(0);
    expect(Payout.create).not.toHaveBeenCalled();
  });

  it('ends 30 bookings with no double pay and no unsent payout', async () => {
    const rows = bookings();
    rows.forEach(seedTerminal);
    for (let pass = 0; pass < ROUNDS; pass += 1) await round(service, rows);
    const text = summary(rows);
    const dir = '/opt/cursor/artifacts';
    if (existsSync(dir) || existsSync('/opt/cursor')) {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(`${dir}/fedapay-storm.txt`, `${text}\n`);
    }
    expect(text).toContain('doublePaid=0');
    expect(text).toContain('orphans=0');
    expect(text).toContain('extraPayouts=0');
    expect(text).toContain('pending:0');
  });

  it('keeps a filter-ignored multi-page list at zero double pays and zero orphans', async () => {
    const lines: string[] = [];
    for (const mode of ['present', 'absent', 'understated', 'shrinking'] as const) {
      lines.push(await pagedCase(service, mode));
    }
    const text = lines.join('\n');
    const dir = '/opt/cursor/artifacts';
    if (existsSync(dir) || existsSync('/opt/cursor')) {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(`${dir}/fedapay-storm-pages.txt`, `${text}\n`);
    }
    expect(text).not.toContain('doublePaid=1');
    expect(text).not.toContain('orphans=1');
    lines.forEach((line) => {
      expect(line).toContain('doublePaid=0');
      expect(line).toContain('orphans=0');
    });
  });

  it('walks 10 to 20 page lists on the resend path without a double pay', async () => {
    const lines = [
      await resendPages(service, 'dead', 10),
      await resendPages(service, 'pending', 15),
      await resendPages(service, 'pending', 20),
      await resendPages(service, 'dead', 15),
      await resendPages(service, 'dead', 20),
    ];
    const text = lines.join('\n');
    const dir = '/opt/cursor/artifacts';
    if (existsSync(dir) || existsSync('/opt/cursor')) {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(`${dir}/fedapay-storm-resend-pages.txt`, `${text}\n`);
    }
    expect(lines[0]).toContain('credited=1');
    expect(lines[0]).toContain('calls=40');
    expect(lines[1]).toContain('sent=1');
    expect(lines[1]).toContain('calls=30');
    expect(lines[2]).toContain('sent=1');
    expect(lines[2]).toContain('calls=40');
    expect(lines[3]).toContain('credited=1');
    expect(lines[3]).toContain('calls=60');
    expect(lines[4]).toContain('credited=1');
    expect(lines[4]).toContain('calls=80');
    lines.forEach((line) => {
      expect(line).toContain('doublePaid=0');
      expect(line).toContain('orphans=0');
    });
  });
});

type PageMode = 'present' | 'absent' | 'understated' | 'shrinking';

function pagedMeta(page: number, pages: number, total: number | null, next: number | null) {
  const meta: Record<string, unknown> = { current_page: page, total_pages: pages, next_page: next, per_page: 1 };
  if (total != null) meta.total_count = total;
  return meta;
}

async function pagedCase(service: FedaPayService, mode: PageMode): Promise<string> {
  store.rows = [];
  store.seq = 9100;
  resetFedapayListSpend();
  const external = `rental-decline-storm-${mode}`;
  if (mode === 'present') store.rows.push({ id: ++store.seq, status: 'pending', externalId: external, sends: 0 });
  if (mode === 'absent' || mode === 'understated') {
    store.rows.push({ id: ++store.seq, status: 'sent', externalId: external, sends: 1 });
  }
  let calls = 0;
  (Payout.all as jest.Mock).mockImplementation(async (query: { page?: number }) => {
    calls += 1;
    return pagedBody(mode, query.page ?? 1, calls, external);
  });
  (Payout.create as jest.Mock).mockClear();
  const result = await service.withdraw({
    payee: '+22878123456',
    amount: 5000,
    externalId: external,
    description: 'Decline refund',
    callback: 'https://test.com/callback',
    channel: 'togocel',
    markedResend: true,
    trustEmptyList: true,
    strictList: true,
  });
  const created = (Payout.create as jest.Mock).mock.calls.length;
  const credited = !result.success && !result.ambiguous;
  const sentRows = store.rows.filter((row) => row.externalId === external && row.sends > 0).length;
  const doublePaid = credited && sentRows > 0 ? 1 : 0;
  const orphans = store.rows.filter((row) => row.status === 'pending' && row.sends === 0).length;
  return `${mode} created=${created} doublePaid=${doublePaid} orphans=${orphans}`;
}

function pagedBody(mode: PageMode, page: number, calls: number, external: string) {
  if (mode === 'present') return presentPage(page, external);
  if (mode === 'absent') return absentPage(page, external);
  if (mode === 'shrinking') return shrinkingPage(page, calls, external);
  return claimedLastPage(external);
}

function absentPage(page: number, external: string) {
  const row = page === 1
    ? { id: 11, status: 'canceled', custom_metadata: { externalId: external } }
    : { id: store.rows[0].id, status: 'sent', custom_metadata: { externalId: external } };
  return { payouts: [row], meta: pagedMeta(page, 2, null, page === 1 ? 2 : null) };
}

function presentPage(page: number, external: string) {
  const rows = [
    { id: 1, status: 'sent', custom_metadata: { externalId: 'other' } },
    { id: 2, status: 'canceled', custom_metadata: { externalId: 'other' } },
    { id: store.rows[0].id, status: 'pending', custom_metadata: { externalId: external } },
  ];
  return { payouts: [rows[page - 1]], meta: pagedMeta(page, 3, 3, page < 3 ? page + 1 : null) };
}

function claimedLastPage(external: string) {
  return {
    payouts: [{ id: 11, status: 'canceled', custom_metadata: { externalId: external } }],
    meta: pagedMeta(1, 1, null, null),
  };
}

function shrinkingPage(page: number, calls: number, external: string) {
  if (calls > 2) {
    return {
      payouts: [{ id: 11, status: 'canceled', custom_metadata: { externalId: external } }],
      meta: pagedMeta(1, 1, 1, null),
    };
  }
  const row = page === 1
    ? { id: 11, status: 'canceled', custom_metadata: { externalId: external } }
    : { id: 12, status: 'failed', custom_metadata: { externalId: external } };
  return { payouts: [row], meta: pagedMeta(page, 2, 2, page === 1 ? 2 : null) };
}

async function resendPages(service: FedaPayService, mode: 'dead' | 'pending', pages: number): Promise<string> {
  resetFedapayListSpend();
  const external = `rental-decline-storm-${mode}-${pages}`;
  let sends = 0;
  const sendNow = jest.fn(async () => { sends += 1; });
  (Payout.all as jest.Mock).mockImplementation(async (query: { page?: number }) => resendBody(mode, query.page ?? 1, pages, external));
  (Payout.retrieve as jest.Mock).mockResolvedValue({ id: 77, status: 'pending', sendNow });
  (Payout.all as jest.Mock).mockClear();
  (Payout.create as jest.Mock).mockClear();
  const look = await service.findPayoutByExternalId(external);
  const result = await service.withdraw({
    payee: '+22878123456',
    amount: 5000,
    externalId: external,
    description: 'Decline refund',
    callback: 'https://test.com/callback',
    channel: 'togocel',
    markedResend: true,
    trustEmptyList: true,
    creditAged: true,
    strictList: true,
  });
  const calls = (Payout.all as jest.Mock).mock.calls.length;
  const created = (Payout.create as jest.Mock).mock.calls.length;
  const credited = !result.success && !result.ambiguous ? 1 : 0;
  const doublePaid = credited && sends > 0 ? 1 : 0;
  const orphans = created > 0 && sends === 0 ? created : 0;
  const limited = look.limited ? 1 : 0;
  return `${mode} pages=${pages} calls=${calls} created=${created} credited=${credited} sent=${sends} limited=${limited} doublePaid=${doublePaid} orphans=${orphans}`;
}

function resendBody(mode: 'dead' | 'pending', page: number, pages: number, external: string) {
  const mine = mode === 'pending' && page === pages;
  const status = mine ? 'pending' : (page % 2 === 0 ? 'failed' : 'canceled');
  return {
    payouts: [{
      id: mine ? 77 : page,
      status,
      custom_metadata: { externalId: mode === 'dead' || mine ? external : 'other' },
    }],
    meta: pagedMeta(page, pages, pages, page < pages ? page + 1 : null),
  };
}
