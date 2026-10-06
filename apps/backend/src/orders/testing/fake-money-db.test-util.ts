/**
 * In-memory stand-in for the Hasura operations used by the deposit money flow:
 * AccountsService (balances, account_transactions incl. the UNIQUE
 * idempotency_key), DepositLedgerService, DepositRefundService and the order /
 * order_holds rows OrdersService reads in the pickup no-show + settlement paths.
 *
 * Every call yields to the event loop first, so two flows started together
 * interleave at each await like two backend requests hitting Postgres.
 * Unknown operations throw, so a test cannot silently pass on an unmodelled call.
 */

export interface FakeAccount {
  id: string;
  user_id: string;
  currency: string;
  available_balance: number;
  withheld_balance: number;
  cash_advance_balance: number;
}

export interface FakeTxn {
  id: string;
  account_id: string;
  amount: number;
  transaction_type: string;
  memo: string | null;
  reference_id: string | null;
  idempotency_key: string | null;
}

type Row = Record<string, any>;

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

function matches(row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([field, cond]) => {
    const value = row[field];
    if (cond && typeof cond === 'object') {
      if ('_eq' in cond && value !== cond._eq) return false;
      if ('_gte' in cond && !(Number(value) >= Number(cond._gte))) return false;
      if ('_lte' in cond && !(Number(value) <= Number(cond._lte))) return false;
      if ('_in' in cond && !(cond._in as unknown[]).includes(value)) return false;
      return true;
    }
    return value === cond;
  });
}

export class FakeMoneyDb {
  accounts = new Map<string, FakeAccount>();
  txns: FakeTxn[] = [];
  orders = new Map<string, Row>();
  holds = new Map<string, Row>();
  hqUserId = 'hq-user';
  unhandled: string[] = [];
  private seq = 0;

  addAccount(account: Partial<FakeAccount> & { id: string; user_id: string }): FakeAccount {
    const row: FakeAccount = {
      currency: 'XAF',
      available_balance: 0,
      withheld_balance: 0,
      cash_advance_balance: 0,
      ...account,
    };
    this.accounts.set(row.id, row);
    return row;
  }

  account(id: string): FakeAccount {
    const row = this.accounts.get(id);
    if (!row) throw new Error(`no account ${id}`);
    return row;
  }

  txnsFor(referenceId: string): Array<Pick<FakeTxn, 'account_id' | 'transaction_type' | 'amount'>> {
    return this.txns
      .filter((t) => t.reference_id === referenceId)
      .map(({ account_id, transaction_type, amount }) => ({
        account_id,
        transaction_type,
        amount,
      }));
  }

  snapshot(): string {
    return JSON.stringify({
      accounts: [...this.accounts.values()],
      txns: this.txns,
    });
  }

  /** HasuraSystemService surface used by the services under test. */
  readonly hasura = {
    executeQuery: (query: string, vars: Row = {}) => this.run(query, vars),
    executeMutation: (query: string, vars: Row = {}) => this.run(query, vars),
    getAccount: async (userId: string, currency: string) => {
      await tick();
      return (
        [...this.accounts.values()].find(
          (a) => a.user_id === userId && a.currency === currency
        ) ?? null
      );
    },
    getRendasuaHQUser: async () => {
      await tick();
      return { id: this.hqUserId };
    },
  };

  private async run(query: string, vars: Row): Promise<any> {
    await tick();
    const op = query.match(/(?:query|mutation)\s+(\w+)/)?.[1] ?? '<anonymous>';
    const handler = (this.handlers as Record<string, (v: Row) => any>)[op];
    if (!handler) {
      this.unhandled.push(op);
      throw new Error(`FakeMoneyDb: unhandled operation ${op}`);
    }
    return handler(vars);
  }

  private insertTxn(vars: Row): FakeTxn {
    const row: FakeTxn = {
      id: `txn-${++this.seq}`,
      account_id: vars.accountId,
      amount: Number(vars.amount),
      transaction_type: vars.transactionType,
      memo: vars.memo ?? null,
      reference_id: vars.referenceId ?? null,
      idempotency_key: vars.idempotencyKey ?? null,
    };
    this.txns.push(row);
    return row;
  }

  private orderView(order: Row): Row {
    return {
      ...order,
      client: { user_id: order.client_user_id },
      order_holds: this.holds.has(order.id) ? [{ ...this.holds.get(order.id) }] : [],
    };
  }

  private readonly handlers = {
    // ---- AccountsService
    GetAccountById: (v: Row) => ({
      accounts_by_pk: this.accounts.has(v.accountId)
        ? { ...this.account(v.accountId) }
        : null,
    }),
    ApplyBalanceDelta: (v: Row) => {
      const rows = [...this.accounts.values()].filter((a) => matches(a, v.where));
      for (const a of rows) {
        a.available_balance += Number(v.inc.available_balance ?? 0);
        a.withheld_balance += Number(v.inc.withheld_balance ?? 0);
        a.cash_advance_balance += Number(v.inc.cash_advance_balance ?? 0);
      }
      return { update_accounts: { returning: rows.map((a) => ({ ...a })) } };
    },
    FindTransactionByIdempotencyKey: (v: Row) => ({
      account_transactions: this.txns.filter((t) =>
        (v.keys as string[]).includes(t.idempotency_key ?? '')
      ),
    }),
    InsertTransactionIdempotent: (v: Row) => {
      if (this.txns.some((t) => t.idempotency_key === v.idempotencyKey)) {
        return { insert_account_transactions_one: null }; // ON CONFLICT DO NOTHING
      }
      return { insert_account_transactions_one: { id: this.insertTxn(v).id } };
    },
    InsertTransaction: (v: Row) => ({
      insert_account_transactions_one: this.insertTxn(v),
    }),
    HasAccountTransaction: (v: Row) => ({
      account_transactions: this.txns
        .filter(
          (t) =>
            t.account_id === v.accountId &&
            t.transaction_type === v.transactionType &&
            t.reference_id === v.referenceId
        )
        .slice(0, 1),
    }),
    SumAppliedDeposit: (v: Row) => ({
      account_transactions: this.txns.filter(
        (t) =>
          t.account_id === v.accountId &&
          t.reference_id === v.referenceId &&
          ['deposit', 'cash_advance_repayment'].includes(t.transaction_type)
      ),
    }),
    // ---- DepositRefundService
    DepositConsumedPayment: (v: Row) => ({
      account_transactions: this.txns
        .filter(
          (t) =>
            t.account_id === v.accountId &&
            t.transaction_type === 'payment' &&
            t.reference_id === v.referenceId
        )
        .slice(0, 1),
    }),
    GetOrderWithDeposit: (v: Row) => {
      const order = this.orders.get(v.orderId);
      return { orders_by_pk: order ? this.orderView(order) : null };
    },
    ReadDepositStatus: (v: Row) => ({
      orders_by_pk: this.orders.has(v.orderId)
        ? { deposit_status: this.orders.get(v.orderId)!.deposit_status }
        : null,
    }),
    ClaimDepositTransition: (v: Row) => {
      const order = this.orders.get(v.orderId);
      if (!order || order.deposit_status !== 'paid') {
        return { update_orders: { affected_rows: 0 } };
      }
      Object.assign(order, v.set);
      return { update_orders: { affected_rows: 1 } };
    },
    RevertDepositRefundClaim: (v: Row) => {
      const order = this.orders.get(v.orderId);
      if (order?.deposit_status === 'refunded' && order.deposit_refund_status === 'pending') {
        order.deposit_status = 'paid';
        return { update_orders: { affected_rows: 1 } };
      }
      return { update_orders: { affected_rows: 0 } };
    },
    CompleteDepositRefund: (v: Row) => {
      const order = this.orders.get(v.orderId);
      if (order?.deposit_status !== 'refunded') return { update_orders: { affected_rows: 0 } };
      order.deposit_refund_status = 'refunded';
      order.deposit_refunded_at = v.now;
      return { update_orders: { affected_rows: 1 } };
    },
    MarkDepositRefundFailed: (v: Row) => {
      const order = this.orders.get(v.orderId);
      if (order) order.deposit_refund_status = 'failed';
      return { update_orders_by_pk: order ? { id: order.id } : null };
    },
    // Pre-fix unconditional forfeit write (only reached when guards are reverted).
    ForfeitDeposit: (v: Row) => {
      const order = this.orders.get(v.orderId);
      if (order) {
        order.deposit_status = 'forfeited';
        order.deposit_forfeit_reason = v.reason;
        order.deposit_forfeited_at = v.now;
      }
      return { update_orders_by_pk: order ? { id: order.id } : null };
    },
    // ---- OrdersService (deposit callback)
    MarkDepositCapturedOnly: (v: Row) => {
      const order = this.orders.get(v.orderId);
      if (order && (v.pendingDeposit as string[]).includes(order.deposit_status)) {
        order.deposit_status = 'paid';
        return { update_orders: { affected_rows: 1 } };
      }
      return { update_orders: { affected_rows: 0 } };
    },
    // ---- pickup no-show clock
    PickupNoshowHours: () => ({
      application_configurations: [{ country_code: null, number_value: 2 }],
    }),
    PickupReadyAt: () => ({
      order_status_history: [
        { created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
      ],
    }),
  };

  /** Snapshot the order the way OrdersService.getOrderDetails returns it. */
  orderDetails(orderId: string): Row | null {
    const order = this.orders.get(orderId);
    if (!order) return null;
    return JSON.parse(
      JSON.stringify({
        ...this.orderView(order),
        business: { user_id: 'store-user-1' },
        business_location: { country_code: 'CM' },
        order_items: [],
      })
    );
  }
}
