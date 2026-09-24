import { BadRequestException, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type { ScheduleFrequency } from './payment-schedule.periods';
import { PaymentScheduleConsentService } from './payment-schedule-consent.service';
import type { ScheduleObjectives } from './payment-schedule-progress.service';

@Injectable()
export class PaymentScheduleCatalogService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly consent: PaymentScheduleConsentService
  ) {}

  async createSchedule(input: CreateScheduleInput) {
    const result = await this.hasura.executeMutation(INSERT_SCHEDULE, {
      object: {
        name: input.name,
        frequency: input.frequency,
        currency: input.currency,
        default_amount: input.defaultAmount,
        default_duration_days: input.defaultDurationDays ?? null,
        created_by: input.createdBy ?? null,
        ...objectivesToColumns(input),
      },
    });
    return result.insert_payment_schedules_one;
  }

  async listSchedules() {
    const result = await this.hasura.executeQuery(LIST_SCHEDULES, {});
    return result.payment_schedules ?? [];
  }

  async updateSchedule(id: string, input: UpdateScheduleInput) {
    const result = await this.hasura.executeMutation(UPDATE_SCHEDULE, {
      id,
      set: schedulePatch(input),
    });
    return result.update_payment_schedules_by_pk;
  }

  async setScheduleActive(id: string, active: boolean) {
    const mutation = active ? REACTIVATE_SCHEDULE : DEACTIVATE_SCHEDULE;
    const result = await this.hasura.executeMutation(mutation, { id });
    return result.update_payment_schedules_by_pk;
  }

  async assign(input: AssignInput) {
    const schedule = await this.requireSchedule(input.scheduleId);
    await this.assertNoOtherOpen(input.scheduleId, input.agentId, NIL_ID);
    const endsAt = input.endsAt ?? this.durationEnd(input.startsAt, schedule.default_duration_days);
    const result = await this.hasura.executeMutation(INSERT_ASSIGNMENT, {
      object: assignmentInsert(input, schedule, endsAt),
    });
    const created = result.insert_payment_schedule_assignments_one;
    if (created?.id) {
      await this.consent.notifyAgentOfOffer(created.id);
    }
    return created;
  }

  async updateAssignment(
    id: string,
    input: {
      amount?: number;
      endsAt?: string | null;
    } & ScheduleObjectives
  ) {
    const row = await this.assignmentById(id);
    if (!row) throw new BadRequestException('Assignment not found');
    if (['active', 'paused'].includes(row.status)) {
      return this.updateActiveTerms(id, input);
    }
    if (
      row.status === 'pending_acceptance' &&
      ['pending', 'deferred'].includes(row.decision)
    ) {
      return this.updateOpenOffer(id, input);
    }
    throw new BadRequestException(
      'Assignment can only change while active, paused, or awaiting a response'
    );
  }

  async setAssignmentStatus(id: string, status: string) {
    const row = await this.assignmentById(id);
    if (!row) throw new BadRequestException('Assignment not found');
    if (!canTransitionAssignment(row.status, status)) {
      throw new BadRequestException('Assignment cannot change to that status');
    }
    if (status === 'active') await this.assertCanResume(row);
    const result = await this.hasura.executeMutation(SET_STATUS, { id, status });
    return result.update_payment_schedule_assignments_by_pk;
  }

  async listForAgentUser(userId: string) {
    const result = await this.hasura.executeQuery(LIST_FOR_USER, { userId });
    return result.payment_schedule_assignments ?? [];
  }

  async searchAgents(search: string) {
    const term = search.trim();
    if (term.length < 2) return [];
    const result = await this.hasura.executeQuery(SEARCH_AGENTS, {
      where: agentSearchWhere(term),
      limit: 8,
    });
    return (result.agents ?? []).map(mapAgentOption);
  }

  private async updateActiveTerms(
    id: string,
    input: { amount?: number; endsAt?: string | null }
  ) {
    const result = await this.hasura.executeMutation(UPDATE_ASSIGNMENT, {
      id,
      set: assignmentTerms(input),
    });
    return result.update_payment_schedule_assignments_by_pk;
  }

  private async updateOpenOffer(
    id: string,
    input: {
      amount?: number;
      endsAt?: string | null;
    } & ScheduleObjectives
  ) {
    const set = {
      ...assignmentTerms(input),
      ...objectivesToColumns(input),
    };
    const result = await this.hasura.executeMutation(UPDATE_ASSIGNMENT, {
      id,
      set,
    });
    await this.consent.notifyAgentOfOffer(id);
    return result.update_payment_schedule_assignments_by_pk;
  }

  private async requireSchedule(id: string) {
    const result = await this.hasura.executeQuery(SCHEDULE_BY_ID, { id });
    const schedule = result.payment_schedules_by_pk;
    if (!schedule?.is_active) throw new BadRequestException('Payment schedule is not active');
    return schedule as ScheduleRow;
  }

  private durationEnd(startsAt: string, days?: number | null): string | null {
    if (!days) return null;
    const end = new Date(startsAt);
    end.setUTCDate(end.getUTCDate() + days);
    return end.toISOString();
  }

  private async assignmentById(id: string) {
    const result = await this.hasura.executeQuery(ASSIGNMENT_BY_ID, { id });
    return result.payment_schedule_assignments_by_pk as AssignmentRow | null;
  }

  private async assertCanResume(row: AssignmentRow) {
    const endsAt = row.ends_at ?? null;
    if (!canResumeAssignment(!!row.schedule?.is_active, endsAt)) {
      throw new BadRequestException('Assignment cannot resume');
    }
    await this.assertNoOtherOpen(row.schedule_id, row.agent_id, row.id);
  }

  private async assertNoOtherOpen(scheduleId: string, agentId: string, exceptId: string) {
    const result = await this.hasura.executeQuery(OPEN_ASSIGNMENT, {
      scheduleId,
      agentId,
      exceptId,
    });
    if (result.payment_schedule_assignments?.length) {
      throw new BadRequestException(
        'This agent already has an open assignment for this schedule'
      );
    }
  }
}

const NIL_ID = '00000000-0000-0000-0000-000000000000';

export function canResumeAssignment(
  scheduleActive: boolean,
  endsAt: string | null,
  now = Date.now()
): boolean {
  if (!scheduleActive) return false;
  if (!endsAt) return true;
  return new Date(endsAt).getTime() > now;
}

export function canTransitionAssignment(from: string, to: string): boolean {
  if (from === to) return true;
  if (from === 'active') return to === 'paused' || to === 'ended';
  if (from === 'paused') return to === 'active' || to === 'ended';
  return false;
}

export function objectivesToColumns(input: ScheduleObjectives) {
  const set: Record<string, number | null> = {};
  if (Object.prototype.hasOwnProperty.call(input, 'targetAgentRecruitments')) {
    set.target_agent_recruitments = nullableInt(input.targetAgentRecruitments);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'targetClientSignups')) {
    set.target_client_signups = nullableInt(input.targetClientSignups);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'targetMerchantRecruitments')) {
    set.target_merchant_recruitments = nullableInt(
      input.targetMerchantRecruitments
    );
  }
  if (Object.prototype.hasOwnProperty.call(input, 'targetItemSalesAmount')) {
    set.target_item_sales_amount = nullableAmount(input.targetItemSalesAmount);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'targetRentalAmount')) {
    set.target_rental_amount = nullableAmount(input.targetRentalAmount);
  }
  return set;
}

function nullableInt(value?: number | null) {
  if (value == null || value <= 0) return null;
  return Math.floor(value);
}

function nullableAmount(value?: number | null) {
  if (value == null || value <= 0) return null;
  return value;
}

function schedulePatch(input: UpdateScheduleInput) {
  return {
    name: input.name,
    frequency: input.frequency,
    default_amount: input.defaultAmount,
    default_duration_days: input.defaultDurationDays ?? null,
    ...objectivesToColumns(input),
  };
}

function assignmentInsert(
  input: AssignInput,
  schedule: ScheduleRow,
  endsAt: string | null
) {
  return {
    schedule_id: input.scheduleId,
    agent_id: input.agentId,
    amount: input.amount ?? schedule.default_amount,
    currency: schedule.currency,
    starts_at: input.startsAt,
    ends_at: endsAt,
    status: 'pending_acceptance',
    decision: 'pending',
    created_by: input.createdBy ?? null,
    target_agent_recruitments: schedule.target_agent_recruitments,
    target_client_signups: schedule.target_client_signups,
    target_merchant_recruitments: schedule.target_merchant_recruitments,
    target_item_sales_amount: schedule.target_item_sales_amount,
    target_rental_amount: schedule.target_rental_amount,
  };
}

function assignmentTerms(input: { amount?: number; endsAt?: string | null }) {
  const set: Record<string, unknown> = {};
  if (input.amount != null) set.amount = input.amount;
  if (input.endsAt !== undefined) set.ends_at = input.endsAt || null;
  return set;
}

export interface UpdateScheduleInput extends ScheduleObjectives {
  name: string;
  frequency: ScheduleFrequency;
  defaultAmount: number;
  defaultDurationDays?: number | null;
}

interface AssignmentRow {
  id: string;
  status: string;
  decision: string;
  schedule_id: string;
  agent_id: string;
  ends_at?: string | null;
  schedule?: { is_active?: boolean };
}

interface ScheduleRow {
  id: string;
  is_active: boolean;
  currency: string;
  default_amount: number;
  default_duration_days?: number | null;
  target_agent_recruitments?: number | null;
  target_client_signups?: number | null;
  target_merchant_recruitments?: number | null;
  target_item_sales_amount?: number | null;
  target_rental_amount?: number | null;
}

export interface CreateScheduleInput extends ScheduleObjectives {
  name: string;
  frequency: ScheduleFrequency;
  currency: string;
  defaultAmount: number;
  defaultDurationDays?: number | null;
  createdBy?: string | null;
}

interface AssignInput {
  scheduleId: string;
  agentId: string;
  amount?: number;
  startsAt: string;
  endsAt?: string | null;
  createdBy?: string | null;
}

const OBJECTIVE_FIELDS = `
  target_agent_recruitments target_client_signups target_merchant_recruitments
  target_item_sales_amount target_rental_amount
`;

const INSERT_SCHEDULE = `
  mutation InsertSchedule($object: payment_schedules_insert_input!) {
    insert_payment_schedules_one(object: $object) {
      id name frequency currency default_amount default_duration_days
      ${OBJECTIVE_FIELDS}
    }
  }
`;

const LIST_SCHEDULES = `
  query ListSchedules {
    payment_schedules(order_by: { created_at: desc }) {
      id name frequency currency default_amount default_duration_days is_active created_at
      ${OBJECTIVE_FIELDS}
      assignments(order_by: { created_at: desc }) {
        id agent_id amount currency starts_at ends_at status decision
        accepted_at reject_reason reject_note
        ${OBJECTIVE_FIELDS}
        agent { agent_code user { first_name last_name email } }
      }
    }
  }
`;

const SCHEDULE_BY_ID = `
  query ScheduleById($id: uuid!) {
    payment_schedules_by_pk(id: $id) {
      id is_active currency default_amount default_duration_days
      ${OBJECTIVE_FIELDS}
    }
  }
`;

const INSERT_ASSIGNMENT = `
  mutation InsertAssignment($object: payment_schedule_assignments_insert_input!) {
    insert_payment_schedule_assignments_one(object: $object) { id }
  }
`;

const SET_STATUS = `
  mutation SetAssignmentStatus($id: uuid!, $status: payment_program_status!) {
    update_payment_schedule_assignments_by_pk(pk_columns: { id: $id }, _set: { status: $status }) { id status }
  }
`;

const UPDATE_SCHEDULE = `
  mutation UpdateSchedule($id: uuid!, $set: payment_schedules_set_input!) {
    update_payment_schedules_by_pk(pk_columns: { id: $id }, _set: $set) { id is_active }
  }
`;

const DEACTIVATE_SCHEDULE = `
  mutation DeactivateSchedule($id: uuid!) {
    update_payment_schedules_by_pk(pk_columns: { id: $id }, _set: { is_active: false }) { id is_active }
    update_payment_schedule_assignments(
      where: { schedule_id: { _eq: $id }, status: { _in: [active, paused, pending_acceptance] } }
      _set: { status: ended }
    ) { affected_rows }
  }
`;

const REACTIVATE_SCHEDULE = `
  mutation ReactivateSchedule($id: uuid!) {
    update_payment_schedules_by_pk(pk_columns: { id: $id }, _set: { is_active: true }) { id is_active }
  }
`;

const ASSIGNMENT_BY_ID = `
  query AssignmentById($id: uuid!) {
    payment_schedule_assignments_by_pk(id: $id) {
      id status decision schedule_id agent_id ends_at
      schedule { is_active }
    }
  }
`;

const OPEN_ASSIGNMENT = `
  query OpenAssignment($scheduleId: uuid!, $agentId: uuid!, $exceptId: uuid!) {
    payment_schedule_assignments(where: {
      schedule_id: { _eq: $scheduleId }
      agent_id: { _eq: $agentId }
      status: { _in: [active, pending_acceptance] }
      id: { _neq: $exceptId }
    }, limit: 1) { id }
  }
`;

const UPDATE_ASSIGNMENT = `
  mutation UpdateAssignment($id: uuid!, $set: payment_schedule_assignments_set_input!) {
    update_payment_schedule_assignments_by_pk(pk_columns: { id: $id }, _set: $set) {
      id amount ends_at
      ${OBJECTIVE_FIELDS}
    }
  }
`;

const LIST_FOR_USER = `
  query SchedulesForUser($userId: uuid!) {
    payment_schedule_assignments(
      where: { agent: { user_id: { _eq: $userId } } }
      order_by: { created_at: desc }
    ) {
      id amount currency starts_at ends_at status decision accepted_at
      reject_reason reject_note
      ${OBJECTIVE_FIELDS}
      schedule { name frequency }
      runs(order_by: { period_start: desc }, limit: 12) {
        id period_start period_end amount status failure_reason created_at
      }
    }
  }
`;

function agentSearchWhere(term: string) {
  return {
    _and: term.split(/\s+/).filter(Boolean).map((token) => ({
      _or: agentTokenMatches(`%${token}%`),
    })),
  };
}

function agentTokenMatches(pattern: string) {
  return [
    { agent_code: { _ilike: pattern } },
    { user: { email: { _ilike: pattern } } },
    { user: { first_name: { _ilike: pattern } } },
    { user: { last_name: { _ilike: pattern } } },
    { user: { referral_code: { _ilike: pattern } } },
  ];
}

function mapAgentOption(row: {
  id: string;
  user_id: string;
  agent_code?: string | null;
  user?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    referral_code?: string | null;
  };
}) {
  const user = row.user ?? {};
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
  return {
    id: row.id,
    userId: row.user_id,
    name: name || user.email || row.id,
    email: user.email ?? '',
    referralCode: user.referral_code || row.agent_code || null,
  };
}

const SEARCH_AGENTS = `
  query SearchPaymentProgramAgents($where: agents_bool_exp!, $limit: Int!) {
    agents(where: $where, limit: $limit, order_by: { created_at: desc }) {
      id user_id agent_code
      user { first_name last_name email referral_code }
    }
  }
`;
