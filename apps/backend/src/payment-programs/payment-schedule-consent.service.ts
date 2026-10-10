import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  PaymentScheduleProgressService,
  pickFeaturedProgress,
  progressWindow,
  type ObjectiveProgress,
  type ScheduleObjectives,
} from './payment-schedule-progress.service';

export type RejectReason =
  | 'too_aggressive'
  | 'not_ready_now'
  | 'targets_unclear'
  | 'other';

const OPEN_DECISIONS = new Set(['pending', 'deferred']);

@Injectable()
export class PaymentScheduleConsentService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly progress: PaymentScheduleProgressService,
    private readonly notifications: NotificationsService
  ) {}

  async listAcceptedDetails(userId: string) {
    const result = await this.hasura.executeQuery(FOCUS_ASSIGNMENTS, { userId });
    const rows = (result.payment_schedule_assignments ?? []) as AssignmentDetail[];
    return Promise.all(rows.map((row) => this.detailOf(row)));
  }

  async getFocusForAgent(userId: string) {
    const result = await this.hasura.executeQuery(FOCUS_ASSIGNMENTS, { userId });
    const rows = (result.payment_schedule_assignments ?? []) as AssignmentDetail[];
    const detailed = await Promise.all(rows.map((row) => this.detailOf(row)));
    const picked = pickFeaturedProgress(detailed);
    return { assignment: picked.featured, otherCount: picked.otherCount };
  }

  async listProgress(input: { search?: string; limit?: number; offset?: number }) {
    const limit = clampPageLimit(input.limit);
    const offset = Math.max(0, input.offset ?? 0);
    const result = await this.hasura.executeQuery(PROGRESS_PAGE, {
      where: progressWhere(input.search),
      limit,
      offset,
    });
    const rows = (result.payment_schedule_assignments ?? []) as AssignmentDetail[];
    const items = await Promise.all(rows.map((row) => this.adminRow(row)));
    const total = Number(
      result.payment_schedule_assignments_aggregate?.aggregate?.count ?? 0
    );
    return { items, total, limit, offset };
  }

  async getDetailForAgent(assignmentId: string, userId: string) {
    const row = await this.requireOwnedAssignment(assignmentId, userId);
    const progress = await this.progressFor(row);
    return mapAssignmentDetail(row, progress);
  }

  async defer(assignmentId: string, userId: string) {
    const row = await this.requireOwnedAssignment(assignmentId, userId);
    this.assertAwaitingResponse(row);
    await this.applyDecision(row.id, {
      decision: 'deferred',
      status: 'pending_acceptance',
      event: 'deferred',
      actorUserId: userId,
    });
    return this.getDetailForAgent(assignmentId, userId);
  }

  async accept(assignmentId: string, userId: string) {
    const row = await this.requireOwnedAssignment(assignmentId, userId);
    this.assertAwaitingResponse(row);
    await this.assertNoOtherOpen(row);
    const acceptedAt = new Date().toISOString();
    await this.applyDecision(row.id, {
      decision: 'accepted',
      status: 'active',
      event: 'accepted',
      actorUserId: userId,
      acceptedAt,
    });
    await this.notifications.notifySuperusersPaymentScheduleDecision({
      assignmentId: row.id,
      scheduleName: row.schedule?.name ?? 'Payment schedule',
      agentName: agentDisplayName(row),
      decision: 'accepted',
      path: `/admin/payment-programs/schedules`,
    });
    return this.getDetailForAgent(assignmentId, userId);
  }

  async reject(
    assignmentId: string,
    userId: string,
    reason: RejectReason,
    note?: string | null
  ) {
    const row = await this.requireOwnedAssignment(assignmentId, userId);
    this.assertAwaitingResponse(row);
    if (reason === 'other' && !note?.trim()) {
      throw new BadRequestException('A note is required when rejecting as other');
    }
    await this.applyDecision(row.id, {
      decision: 'rejected',
      status: 'rejected',
      event: 'rejected',
      actorUserId: userId,
      reasonCode: reason,
      note: note?.trim() || null,
      rejectReason: reason,
      rejectNote: note?.trim() || null,
    });
    await this.notifications.notifySuperusersPaymentScheduleDecision({
      assignmentId: row.id,
      scheduleName: row.schedule?.name ?? 'Payment schedule',
      agentName: agentDisplayName(row),
      decision: 'rejected',
      reason,
      note: note?.trim() || null,
      path: `/admin/payment-programs/schedules`,
    });
    return this.getDetailForAgent(assignmentId, userId);
  }

  async listPendingForAgentUser(userId: string): Promise<
    Array<{ id: string; scheduleName: string }>
  > {
    const result = await this.hasura.executeQuery(LIST_PENDING, { userId });
    return (result.payment_schedule_assignments ?? []).map(
      (row: { id: string; schedule?: { name?: string } }) => ({
        id: row.id,
        scheduleName: row.schedule?.name ?? 'Payment schedule',
      })
    );
  }

  async notifyAgentOfOffer(assignmentId: string): Promise<void> {
    const result = await this.hasura.executeQuery(ASSIGNMENT_DETAIL, {
      id: assignmentId,
    });
    const row = result.payment_schedule_assignments_by_pk as AssignmentDetail | null;
    if (!row?.agent?.user_id) return;
    const name = row.schedule?.name ?? 'Payment schedule';
    await this.notifications.sendPaymentProgramNotice({
      userId: row.agent.user_id,
      title: 'New payment plan offer',
      body: `Review and respond to ${name}.`,
      messageType: 'PAYMENT_SCHEDULE_OFFER',
      entityId: assignmentId,
      path: `/accounts/schedules/${assignmentId}`,
      event: 'wallet.schedule_offer',
    });
    await this.hasura.executeMutation(INSERT_DECISION, {
      object: {
        assignment_id: assignmentId,
        event: 'offered',
        actor_user_id: row.created_by ?? null,
      },
    });
  }

  private async detailOf(row: AssignmentDetail) {
    return mapAssignmentDetail(row, await this.progressFor(row));
  }

  private async adminRow(row: AssignmentDetail) {
    const detail = await this.detailOf(row);
    return { ...detail, agentName: agentDisplayName(row) };
  }

  private async progressFor(row: AssignmentDetail): Promise<ObjectiveProgress> {
    return this.progress.compute({
      agentId: row.agent_id,
      agentUserId: row.agent?.user_id ?? '',
      currency: row.currency,
      startsAt: row.starts_at,
      acceptedAt: row.accepted_at,
      endsAt: row.ends_at,
      targets: targetsFromRow(row),
    });
  }

  private async requireOwnedAssignment(
    assignmentId: string,
    userId: string
  ): Promise<AssignmentDetail> {
    const result = await this.hasura.executeQuery(ASSIGNMENT_DETAIL, {
      id: assignmentId,
    });
    const row = result.payment_schedule_assignments_by_pk as AssignmentDetail | null;
    if (!row) throw new NotFoundException('Assignment not found');
    if (row.agent?.user_id !== userId) {
      throw new ForbiddenException('Assignment does not belong to this agent');
    }
    return row;
  }

  private assertAwaitingResponse(row: AssignmentDetail) {
    if (row.status !== 'pending_acceptance' || !OPEN_DECISIONS.has(row.decision)) {
      throw new BadRequestException(
        'This payment plan is no longer awaiting a response'
      );
    }
  }

  private async assertNoOtherOpen(row: AssignmentDetail) {
    const scheduleId = row.schedule?.id;
    if (!scheduleId) {
      throw new BadRequestException('Assignment schedule is missing');
    }
    const result = await this.hasura.executeQuery(OPEN_ASSIGNMENT, {
      scheduleId,
      agentId: row.agent_id,
      exceptId: row.id,
    });
    if (result.payment_schedule_assignments?.length) {
      throw new BadRequestException(
        'This agent already has an open assignment for this schedule'
      );
    }
  }

  private async applyDecision(
    id: string,
    input: {
      decision: string;
      status: string;
      event: string;
      actorUserId: string;
      acceptedAt?: string;
      reasonCode?: RejectReason;
      note?: string | null;
      rejectReason?: RejectReason;
      rejectNote?: string | null;
    }
  ) {
    const set: Record<string, unknown> = {
      decision: input.decision,
      status: input.status,
    };
    if (input.acceptedAt) set.accepted_at = input.acceptedAt;
    if (input.rejectReason) set.reject_reason = input.rejectReason;
    if (input.rejectNote !== undefined) set.reject_note = input.rejectNote;
    await this.hasura.executeMutation(UPDATE_ASSIGNMENT_DECISION, { id, set });
    await this.hasura.executeMutation(INSERT_DECISION, {
      object: {
        assignment_id: id,
        event: input.event,
        reason_code: input.reasonCode ?? null,
        note: input.note ?? null,
        actor_user_id: input.actorUserId,
      },
    });
  }
}

function targetsFromRow(row: AssignmentDetail): ScheduleObjectives {
  return {
    targetAgentRecruitments: row.target_agent_recruitments,
    targetClientSignups: row.target_client_signups,
    targetMerchantRecruitments: row.target_merchant_recruitments,
    targetItemSalesAmount: row.target_item_sales_amount,
    targetRentalAmount: row.target_rental_amount,
  };
}

function mapAssignmentDetail(row: AssignmentDetail, progress: ObjectiveProgress) {
  return {
    id: row.id,
    status: row.status,
    decision: row.decision,
    amount: Number(row.amount),
    currency: row.currency,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    acceptedAt: row.accepted_at,
    rejectReason: row.reject_reason,
    rejectNote: row.reject_note,
    schedule: {
      id: row.schedule?.id,
      name: row.schedule?.name,
      frequency: row.schedule?.frequency,
    },
    targets: {
      agentRecruitments: row.target_agent_recruitments,
      clientSignups: row.target_client_signups,
      merchantRecruitments: row.target_merchant_recruitments,
      itemSalesAmount: row.target_item_sales_amount,
      rentalAmount: row.target_rental_amount,
    },
    progress,
    progressWindow: assignmentWindow(row),
    runs: (row.runs ?? []).map((run) => ({
      id: run.id,
      periodStart: run.period_start,
      periodEnd: run.period_end,
      amount: Number(run.amount),
      status: run.status,
      failureReason: run.failure_reason,
      createdAt: run.created_at,
    })),
  };
}

function assignmentWindow(row: AssignmentDetail) {
  if (!row.accepted_at) return null;
  return progressWindow(row.starts_at, row.accepted_at, row.ends_at);
}

const PAGE_LIMIT = 20;
const PAGE_LIMIT_MAX = 50;

function clampPageLimit(limit?: number): number {
  if (!limit || limit < 1) return PAGE_LIMIT;
  return Math.min(PAGE_LIMIT_MAX, Math.floor(limit));
}

const OBJECTIVE_FILTER = [
  { target_agent_recruitments: { _gt: 0 } },
  { target_client_signups: { _gt: 0 } },
  { target_merchant_recruitments: { _gt: 0 } },
  { target_item_sales_amount: { _gt: 0 } },
  { target_rental_amount: { _gt: 0 } },
];

function progressWhere(search?: string) {
  const where: Record<string, unknown> = {
    decision: { _eq: 'accepted' },
    status: { _in: ['active', 'paused'] },
    _or: OBJECTIVE_FILTER,
  };
  const term = search?.trim();
  if (!term) return where;
  const like = `%${term.replace(/[%_\\]/g, '')}%`;
  return { ...where, agent: { user: { _or: nameFilters(like) } } };
}

function nameFilters(like: string) {
  return [
    { first_name: { _ilike: like } },
    { last_name: { _ilike: like } },
    { email: { _ilike: like } },
  ];
}

function agentDisplayName(row: AssignmentDetail): string {
  const user = row.agent?.user;
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ');
  return name || user?.email || 'Agent';
}

interface AssignmentDetail {
  id: string;
  agent_id: string;
  amount: number;
  currency: string;
  starts_at: string;
  ends_at?: string | null;
  status: string;
  decision: string;
  accepted_at?: string | null;
  reject_reason?: string | null;
  reject_note?: string | null;
  created_by?: string | null;
  target_agent_recruitments?: number | null;
  target_client_signups?: number | null;
  target_merchant_recruitments?: number | null;
  target_item_sales_amount?: number | null;
  target_rental_amount?: number | null;
  schedule?: {
    id?: string;
    name?: string;
    frequency?: string;
  };
  agent?: {
    user_id?: string;
    user?: { first_name?: string; last_name?: string; email?: string };
  };
  runs?: Array<{
    id: string;
    period_start: string;
    period_end: string;
    amount: number;
    status: string;
    failure_reason?: string | null;
    created_at: string;
  }>;
}

const ASSIGNMENT_DETAIL = `
  query AssignmentDetail($id: uuid!) {
    payment_schedule_assignments_by_pk(id: $id) {
      id agent_id amount currency starts_at ends_at status decision
      accepted_at reject_reason reject_note created_by
      target_agent_recruitments target_client_signups target_merchant_recruitments
      target_item_sales_amount target_rental_amount
      schedule { id name frequency }
      agent { user_id user { first_name last_name email } }
      runs(order_by: { period_start: desc }, limit: 12) {
        id period_start period_end amount status failure_reason created_at
      }
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

const UPDATE_ASSIGNMENT_DECISION = `
  mutation UpdateAssignmentDecision($id: uuid!, $set: payment_schedule_assignments_set_input!) {
    update_payment_schedule_assignments_by_pk(pk_columns: { id: $id }, _set: $set) { id }
  }
`;

const INSERT_DECISION = `
  mutation InsertAssignmentDecision($object: payment_schedule_assignment_decisions_insert_input!) {
    insert_payment_schedule_assignment_decisions_one(object: $object) { id }
  }
`;

const ASSIGNMENT_FIELDS = `
  id agent_id amount currency starts_at ends_at status decision
  accepted_at reject_reason reject_note created_by
  target_agent_recruitments target_client_signups target_merchant_recruitments
  target_item_sales_amount target_rental_amount
  schedule { id name frequency }
  agent { user_id user { first_name last_name email } }
  runs(order_by: { period_start: desc }, limit: 12) {
    id period_start period_end amount status failure_reason created_at
  }
`;

const FOCUS_ASSIGNMENTS = `
  query FocusScheduleAssignments($userId: uuid!) {
    payment_schedule_assignments(where: {
      agent: { user_id: { _eq: $userId } }
      decision: { _eq: accepted }
      status: { _in: [active, paused] }
      _or: [
        { target_agent_recruitments: { _gt: 0 } }
        { target_client_signups: { _gt: 0 } }
        { target_merchant_recruitments: { _gt: 0 } }
        { target_item_sales_amount: { _gt: 0 } }
        { target_rental_amount: { _gt: 0 } }
      ]
    }) { ${ASSIGNMENT_FIELDS} }
  }
`;

const PROGRESS_PAGE = `
  query AssignmentProgressPage(
    $where: payment_schedule_assignments_bool_exp!
    $limit: Int!
    $offset: Int!
  ) {
    payment_schedule_assignments(
      where: $where
      order_by: [{ accepted_at: desc }, { id: asc }]
      limit: $limit
      offset: $offset
    ) { ${ASSIGNMENT_FIELDS} }
    payment_schedule_assignments_aggregate(where: $where) {
      aggregate { count }
    }
  }
`;

const LIST_PENDING = `
  query PendingScheduleOffers($userId: uuid!) {
    payment_schedule_assignments(where: {
      agent: { user_id: { _eq: $userId } }
      decision: { _in: [pending, deferred] }
      status: { _eq: pending_acceptance }
    }) {
      id
      schedule { name }
    }
  }
`;
