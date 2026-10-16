import { AccountsController } from './accounts.controller';

describe('AccountsController in-flight GIVE_CHANGE list', () => {
  function controller() {
    const executeQuery = jest.fn().mockResolvedValue({ accounts: [], clients: [] });
    const accounts = new AccountsController(
      { getUser: jest.fn().mockResolvedValue({ id: 'user-1' }) } as never,
      { executeQuery } as never,
      {} as never,
      {} as never
    );
    return { accounts, executeQuery };
  }

  async function giveChangeFilter(load: () => Promise<unknown>, executeQuery: jest.Mock) {
    await load();
    const query = executeQuery.mock.calls[0][0] as string;
    expect(query).toContain('transaction_type: { _eq: "GIVE_CHANGE" }');
    expect(query).toContain('status: { _in: ["pending", "processing"] }');
    expect(executeQuery.mock.calls[0][1]).toEqual({ userId: 'user-1' });
  }

  it('keeps a processing payout on the account info list', async () => {
    const { accounts, executeQuery } = controller();
    await giveChangeFilter(() => accounts.getAccountInfo({} as never), executeQuery);
  });

  it('keeps a processing payout on the accounts list', async () => {
    const { accounts, executeQuery } = controller();
    await giveChangeFilter(() => accounts.getAccounts({} as never), executeQuery);
  });
});
