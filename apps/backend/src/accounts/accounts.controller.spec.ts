import { AccountsController } from './accounts.controller';

describe('AccountsController HTTP surface', () => {
  it('does not expose raw ledger posts on POST /accounts/transaction', () => {
    expect(AccountsController.prototype).not.toHaveProperty(
      'registerTransaction'
    );
  });
});
