import { BadRequestException, Injectable } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import { drawCopy, facilityCopy } from './payment-program.messages';

@Injectable()
export class CashAdvanceService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly accounts: AccountsService,
    private readonly notifications: NotificationsService
  ) {}

  async createProgram(input: {
    name: string;
    currency: string;
    defaultLimit: number;
    createdBy?: string | null;
  }) {
    const result = await this.hasura.executeMutation(INSERT_PROGRAM, {
      object: {
        name: input.name,
        currency: input.currency,
        default_limit: input.defaultLimit,
        created_by: input.createdBy ?? null,
      },
    });
    return result.insert_cash_advance_programs_one;
  }

  async listPrograms() {
    const result = await this.hasura.executeQuery(LIST_PROGRAMS, {});
    return result.cash_advance_programs ?? [];
  }

  async openFacility(input: OpenFacilityInput) {
    const account = await this.personalAccount(input.userId, input.currency);
    const facility = await this.insertFacility(input, account.id);
    await this.notifications.sendPaymentProgramNotice({
      userId: input.userId,
      ...facilityCopy({
        limit: input.limitAmount,
        currency: input.currency,
        name: input.programName,
        preferredLanguage: input.preferredLanguage,
      }),
      messageType: 'CASH_ADVANCE_FACILITY',
      entityId: facility.id,
      path: '/accounts/cash-advance',
      event: 'wallet.cash_advance.facility',
    });
    return facility;
  }

  async listForUser(userId: string) {
    const result = await this.hasura.executeQuery(LIST_FACILITIES, { userId });
    return result.cash_advance_facilities ?? [];
  }

  async draw(userId: string, amount: number, currency: string) {
    const facility = await this.requireDrawableFacility(userId, currency);
    const account = facility.account;
    const remaining = drawableRemaining(
      facility.limit_amount,
      account.cash_advance_balance ?? 0
    );
    if (amount > remaining) {
      throw new BadRequestException('Draw exceeds the remaining cash-advance limit');
    }
    const tx = await this.accounts.registerTransaction({
      accountId: account.id,
      amount,
      transactionType: 'cash_advance',
      memo: `Cash advance draw - ${facility.program?.name ?? 'program'}`,
    });
    if (!tx.success) throw new BadRequestException(tx.error || 'Draw failed');
    await this.hasura.executeMutation(INSERT_DRAW, {
      object: { facility_id: facility.id, amount, transaction_id: tx.transactionId },
    });
    await this.notifications.sendPaymentProgramNotice({
      userId,
      ...drawCopy({ amount, currency, preferredLanguage: facility.user?.preferred_language }),
      messageType: 'CASH_ADVANCE_DRAW',
      entityId: facility.id,
      path: '/accounts/cash-advance',
      event: 'wallet.cash_advance.draw',
    });
    return { transactionId: tx.transactionId, newBalance: tx.newBalance };
  }

  private async personalAccount(userId: string, currency: string) {
    const result = await this.hasura.executeQuery(PERSONAL_ACCOUNT, { userId, currency });
    const account = result.accounts?.[0];
    if (!account) throw new BadRequestException('No personal wallet for this currency');
    return account;
  }

  private async insertFacility(input: OpenFacilityInput, accountId: string) {
    const result = await this.hasura.executeMutation(INSERT_FACILITY, {
      object: {
        program_id: input.programId,
        user_id: input.userId,
        account_id: accountId,
        limit_amount: input.limitAmount,
        currency: input.currency,
        ends_at: input.endsAt ?? null,
        created_by: input.createdBy ?? null,
      },
    });
    return result.insert_cash_advance_facilities_one;
  }

  private async requireDrawableFacility(userId: string, currency: string) {
    const result = await this.hasura.executeQuery(ACTIVE_FACILITY, { userId, currency });
    const facility = result.cash_advance_facilities?.[0];
    if (!facility) throw new BadRequestException('No active cash-advance facility');
    if (facility.ends_at && new Date(facility.ends_at).getTime() <= Date.now()) {
      throw new BadRequestException('Cash-advance facility has ended');
    }
    return facility;
  }
}

interface OpenFacilityInput {
  programId: string;
  programName: string;
  userId: string;
  currency: string;
  limitAmount: number;
  endsAt?: string | null;
  createdBy?: string | null;
  preferredLanguage?: string | null;
}

const INSERT_PROGRAM = `
  mutation InsertCashAdvanceProgram($object: cash_advance_programs_insert_input!) {
    insert_cash_advance_programs_one(object: $object) { id name currency default_limit }
  }
`;

const LIST_PROGRAMS = `
  query ListCashAdvancePrograms {
    cash_advance_programs(order_by: { created_at: desc }) {
      id name currency default_limit is_active created_at
    }
  }
`;

const PERSONAL_ACCOUNT = `
  query PersonalAccount($userId: uuid!, $currency: currency_enum!) {
    accounts(where: {
      user_id: { _eq: $userId }
      currency: { _eq: $currency }
      business_location_id: { _is_null: true }
    }, limit: 1) { id }
  }
`;

const INSERT_FACILITY = `
  mutation InsertFacility($object: cash_advance_facilities_insert_input!) {
    insert_cash_advance_facilities_one(object: $object) { id }
  }
`;

const LIST_FACILITIES = `
  query ListFacilities($userId: uuid!) {
    cash_advance_facilities(where: { user_id: { _eq: $userId } }, order_by: { created_at: desc }) {
      id limit_amount currency status ends_at created_at
      program { id name }
      account { id cash_advance_balance available_balance currency }
      draws(order_by: { created_at: desc }) { id amount created_at }
    }
  }
`;

const ACTIVE_FACILITY = `
  query ActiveFacility($userId: uuid!, $currency: currency_enum!) {
    cash_advance_facilities(where: {
      user_id: { _eq: $userId }
      currency: { _eq: $currency }
      status: { _eq: active }
    }, limit: 1) {
      id limit_amount ends_at
      program { name }
      account { id cash_advance_balance }
      user { preferred_language }
    }
  }
`;

const INSERT_DRAW = `
  mutation InsertDraw($object: cash_advance_draws_insert_input!) {
    insert_cash_advance_draws_one(object: $object) { id }
  }
`;

export function drawableRemaining(limitAmount: number, cashAdvanceBalance: number): number {
  const owed = Math.abs(Number(cashAdvanceBalance || 0));
  return Math.max(0, Number(limitAmount) - owed);
}
