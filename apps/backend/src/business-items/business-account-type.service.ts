import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  ACCOUNT_TYPE_LOCK_DAYS,
  BusinessAccountType,
  getCommissionForBusinessAccountType,
} from '../commissions/business-account-type';

@Injectable()
export class BusinessAccountTypeService {
  constructor(
    private readonly hasuraSystemService: HasuraSystemService
  ) {}

  async getBusinessByUserId(userId: string) {
    const query = `
      query GetBusinessAccountType($userId: uuid!) {
        businesses(where: { user_id: { _eq: $userId } }, limit: 1) {
          id
          account_type
          account_type_locked_until
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, { userId });
    return result.businesses?.[0] ?? null;
  }

  async getBusinessById(businessId: string) {
    const query = `
      query GetBusinessAccountTypeById($id: uuid!) {
        businesses_by_pk(id: $id) {
          id
          account_type
          account_type_locked_until
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, { id: businessId });
    return result.businesses_by_pk ?? null;
  }

  private async updateAccountType(
    businessId: string,
    fromType: string | null,
    toType: string,
    changedByUserId: string | null,
    changeSource: 'self_serve' | 'admin',
    reason: string | null,
    lockUntil: string | null
  ) {
    const mutation = `
      mutation UpdateBusinessAccountType(
        $id: uuid!
        $accountType: String!
        $lockedUntil: timestamptz
        $businessId: uuid!
        $fromType: String
        $toType: String!
        $changedBy: uuid
        $source: String!
        $reason: String
      ) {
        update_businesses_by_pk(
          pk_columns: { id: $id }
          _set: {
            account_type: $accountType
            account_type_locked_until: $lockedUntil
            updated_at: "now()"
          }
        ) {
          id
          account_type
          account_type_locked_until
        }
        insert_business_account_type_history_one(object: {
          business_id: $businessId
          from_account_type: $fromType
          to_account_type: $toType
          changed_by_user_id: $changedBy
          change_source: $source
          reason: $reason
        }) {
          id
        }
      }
    `;
    const result = await this.hasuraSystemService.executeMutation(mutation, {
      id: businessId,
      accountType: toType,
      lockedUntil: lockUntil,
      businessId,
      fromType,
      toType,
      changedBy: changedByUserId,
      source: changeSource,
      reason,
    });
    return result.update_businesses_by_pk;
  }

  async selfServeChange(userId: string, newAccountType: string) {
    const business = await this.getBusinessByUserId(userId);
    if (!business) {
      throw new NotFoundException('Business not found for this user');
    }
    if (business.account_type === newAccountType) {
      return this.buildResponse(business);
    }
    if (business.account_type_locked_until) {
      const lockedUntil = new Date(business.account_type_locked_until);
      if (lockedUntil > new Date()) {
        throw new ConflictException({
          message: `Your plan is locked until ${lockedUntil.toISOString()}. Plans are committed for ${ACCOUNT_TYPE_LOCK_DAYS} days.`,
          lockedUntil: lockedUntil.toISOString(),
        });
      }
    }
    const lockUntil = new Date();
    lockUntil.setDate(lockUntil.getDate() + ACCOUNT_TYPE_LOCK_DAYS);

    const updated = await this.updateAccountType(
      business.id,
      business.account_type,
      newAccountType,
      userId,
      'self_serve',
      null,
      lockUntil.toISOString()
    );
    return this.buildResponse(updated);
  }

  async adminChange(
    businessId: string,
    newAccountType: string,
    adminUserId: string,
    reason?: string
  ) {
    const business = await this.getBusinessById(businessId);
    if (!business) {
      throw new NotFoundException('Business not found');
    }
    const updated = await this.updateAccountType(
      businessId,
      business.account_type,
      newAccountType,
      adminUserId,
      'admin',
      reason ?? null,
      null
    );
    return this.buildResponse(updated);
  }

  private buildResponse(business: { account_type: string; account_type_locked_until?: string | null }) {
    const accountType = (business.account_type as BusinessAccountType) ?? BusinessAccountType.STANDARD;
    return {
      accountType,
      commissionPercentage: getCommissionForBusinessAccountType(accountType),
      lockedUntil: business.account_type_locked_until ?? null,
    };
  }
}
