import { BadRequestException, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type { ScheduleFrequency } from './payment-schedule.periods';

@Injectable()
export class PaymentScheduleCatalogService {
  constructor(private readonly hasura: HasuraSystemService) {}

  async createSchedule(input: CreateScheduleInput) {
    const result = await this.hasura.executeMutation(INSERT_SCHEDULE, {
      object: {
        name: input.name,
        frequency: input.frequency,
        currency: input.currency,
        default_amount: input.defaultAmount,
        default_duration_days: input.defaultDurationDays ?? null,
        created_by: input.createdBy ?? null,
      },
    });
    return result.insert_payment_schedules_one;
  }

  async listSchedules() {
    const result = await this.hasura.executeQuery(LIST_SCHEDULES, {});
    return result.payment_schedules ?? [];
  }

  async assign(input: AssignInput) {
    const schedule = await this.requireSchedule(input.scheduleId);
    const endsAt = input.endsAt ?? this.durationEnd(input.startsAt, schedule.default_duration_days);
    const result = await this.hasura.executeMutation(INSERT_ASSIGNMENT, {
      object: {
        schedule_id: input.scheduleId,
        agent_id: input.agentId,
        amount: input.amount ?? schedule.default_amount,
        currency: schedule.currency,
        starts_at: input.startsAt,
        ends_at: endsAt,
        created_by: input.createdBy ?? null,
      },
    });
    return result.insert_payment_schedule_assignments_one;
  }

  async setAssignmentStatus(id: string, status: string) {
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

  private async requireSchedule(id: string) {
    const result = await this.hasura.executeQuery(SCHEDULE_BY_ID, { id });
    const schedule = result.payment_schedules_by_pk;
    if (!schedule?.is_active) throw new BadRequestException('Payment schedule is not active');
    return schedule;
  }

  private durationEnd(startsAt: string, days?: number | null): string | null {
    if (!days) return null;
    const end = new Date(startsAt);
    end.setUTCDate(end.getUTCDate() + days);
    return end.toISOString();
  }
}

export interface CreateScheduleInput {
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

const INSERT_SCHEDULE = `
  mutation InsertSchedule($object: payment_schedules_insert_input!) {
    insert_payment_schedules_one(object: $object) {
      id name frequency currency default_amount default_duration_days
    }
  }
`;

const LIST_SCHEDULES = `
  query ListSchedules {
    payment_schedules(order_by: { created_at: desc }) {
      id name frequency currency default_amount default_duration_days is_active created_at
      assignments(order_by: { created_at: desc }) {
        id agent_id amount currency starts_at ends_at status
        agent { agent_code user { first_name last_name email } }
      }
    }
  }
`;

const SCHEDULE_BY_ID = `
  query ScheduleById($id: uuid!) {
    payment_schedules_by_pk(id: $id) {
      id is_active currency default_amount default_duration_days
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

const LIST_FOR_USER = `
  query SchedulesForUser($userId: uuid!) {
    payment_schedule_assignments(
      where: { agent: { user_id: { _eq: $userId } } }
      order_by: { created_at: desc }
    ) {
      id amount currency starts_at ends_at status
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
