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

  async updateProgram(id: string, input: { name: string; defaultLimit: number }) {
    const result = await this.hasura.executeMutation(UPDATE_PROGRAM, {
      id,
      set: { name: input.name, default_limit: input.defaultLimit },
    });
    return result.update_cash_advance_programs_by_pk;
  }

  async setProgramActive(id: string, isActive: boolean) {
    const result = await this.hasura.executeMutation(SET_PROGRAM_ACTIVE, { id, isActive });
    return result.update_cash_advance_programs_by_pk;
  }

  async openFacility(input: OpenFacilityInput) {
    await this.requireActiveProgram(input.programId);
    const account = await this.personalAccount(input.userId, input.currency);
    const facility = await this.insertFacility(input, account.id);
    await this.notifyFacility(input, facility.id);
    return facility;
  }

  async updateFacility(id: string, input: { limitAmount?: number; endsAt?: string | null }) {
    const row = await this.facilityById(id);
    this.assertFacilityEditable(row, input.limitAmount);
    const result = await this.hasura.executeMutation(UPDATE_FACILITY, {
      id,
      set: facilityPatch(input),
    });
    return result.update_cash_advance_facilities_by_pk;
  }

  async closeFacility(id: string) {
    const result = await this.hasura.executeMutation(CLOSE_FACILITY, { id });
    return result.update_cash_advance_facilities_by_pk;
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

  private async requireActiveProgram(id: string) {
    const result = await this.hasura.executeQuery(PROGRAM_BY_ID, { id });
    if (!result.cash_advance_programs_by_pk?.is_active) {
      throw new BadRequestException('Cash-advance program is not active');
    }
  }

  private async facilityById(id: string) {
    const result = await this.hasura.executeQuery(FACILITY_BY_ID, { id });
    return result.cash_advance_facilities_by_pk;
  }

  private assertFacilityEditable(
    row: { status?: string; account?: { cash_advance_balance?: number } } | null,
    limitAmount?: number
  ) {
    if (!row || row.status !== 'active') {
      throw new BadRequestException('Facility is not editable');
    }
    const drawn = row.account?.cash_advance_balance ?? 0;
    if (limitAmount != null && !limitCoversDrawn(limitAmount, drawn)) {
      throw new BadRequestException('Limit cannot be below the amount already drawn');
    }
  }

  private async notifyFacility(input: OpenFacilityInput, facilityId: string) {
    await this.notifications.sendPaymentProgramNotice({
      userId: input.userId,
      ...facilityCopy({
        limit: input.limitAmount,
        currency: input.currency,
        name: input.programName,
        preferredLanguage: input.preferredLanguage,
      }),
      messageType: 'CASH_ADVANCE_FACILITY',
      entityId: facilityId,
      path: '/accounts/cash-advance',
      event: 'wallet.cash_advance.facility',
    });
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
      facilities(order_by: { created_at: desc }) {
        id user_id limit_amount currency status ends_at
        user { first_name last_name email }
        account { cash_advance_balance }
      }
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

const PROGRAM_BY_ID = `
  query CashAdvanceProgramById($id: uuid!) {
    cash_advance_programs_by_pk(id: $id) { id is_active }
  }
`;

const FACILITY_BY_ID = `
  query FacilityById($id: uuid!) {
    cash_advance_facilities_by_pk(id: $id) {
      id status
      account { cash_advance_balance }
    }
  }
`;

const UPDATE_PROGRAM = `
  mutation UpdateCashAdvanceProgram($id: uuid!, $set: cash_advance_programs_set_input!) {
    update_cash_advance_programs_by_pk(pk_columns: { id: $id }, _set: $set) { id }
  }
`;

const SET_PROGRAM_ACTIVE = `
  mutation SetCashAdvanceProgramActive($id: uuid!, $isActive: Boolean!) {
    update_cash_advance_programs_by_pk(pk_columns: { id: $id }, _set: { is_active: $isActive }) { id is_active }
  }
`;

const UPDATE_FACILITY = `
  mutation UpdateFacility($id: uuid!, $set: cash_advance_facilities_set_input!) {
    update_cash_advance_facilities_by_pk(pk_columns: { id: $id }, _set: $set) { id limit_amount ends_at }
  }
`;

const CLOSE_FACILITY = `
  mutation CloseFacility($id: uuid!) {
    update_cash_advance_facilities_by_pk(pk_columns: { id: $id }, _set: { status: closed }) { id status }
  }
`;

export function drawableRemaining(limitAmount: number, cashAdvanceBalance: number): number {
  const owed = Math.abs(Number(cashAdvanceBalance || 0));
  return Math.max(0, Number(limitAmount) - owed);
}

export function limitCoversDrawn(limitAmount: number, cashAdvanceBalance: number): boolean {
  return Number(limitAmount) >= Math.abs(Number(cashAdvanceBalance || 0));
}

function facilityPatch(input: { limitAmount?: number; endsAt?: string | null }) {
  const set: Record<string, unknown> = {};
  if (input.limitAmount != null) set.limit_amount = input.limitAmount;
  if (input.endsAt !== undefined) set.ends_at = input.endsAt || null;
  return set;
}
