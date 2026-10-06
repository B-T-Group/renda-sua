import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { PlatformPermissions } from '../rbac/platform-permissions';
import { RbacService } from '../rbac/rbac.service';

/**
 * Read access to a single mobile payment transaction.
 * Allowed: the user who owns the linked account, or a platform admin with
 * the mobile payments permission (superuser passes). A transaction without a
 * linked account is admin-only.
 */
@Injectable()
export class MobileTransactionAccessService {
  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly rbacService: RbacService
  ) {}

  async canView(
    transaction: { account_id?: string | null },
    userId: string | null | undefined
  ): Promise<boolean> {
    if (!userId) return false;
    if (transaction.account_id) {
      const ownerId = await this.getAccountOwnerId(transaction.account_id);
      if (ownerId && ownerId === userId) return true;
    }
    return this.rbacService.hasPermission(
      userId,
      PlatformPermissions.FINANCIAL_MOBILE_PAYMENTS
    );
  }

  private async getAccountOwnerId(accountId: string): Promise<string | null> {
    const result = await this.hasuraSystemService.executeQuery(
      `
      query MobileTransactionAccountOwner($accountId: uuid!) {
        accounts_by_pk(id: $accountId) {
          id
          user_id
        }
      }
    `,
      { accountId }
    );
    const account = result?.accounts_by_pk as
      | { id: string; user_id: string | null }
      | null
      | undefined;
    return account?.user_id ?? null;
  }
}
