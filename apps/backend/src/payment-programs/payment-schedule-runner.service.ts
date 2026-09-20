import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AccountsService } from '../accounts/accounts.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import { currentPeriod, type ScheduleFrequency } from './payment-schedule.periods';
import { scheduleCreditCopy } from './payment-program.messages';

interface AssignmentRow {
  id: string;
  amount: number;
  currency: string;
  starts_at: string;
  ends_at: string | null;
  schedule: { name: string; frequency: ScheduleFrequency };
  agent: { user_id: string; user: { preferred_language: string | null } | null };
}

@Injectable()
export class PaymentScheduleRunnerService {
  private readonly logger = new Logger(PaymentScheduleRunnerService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly accounts: AccountsService,
    private readonly notifications: NotificationsService
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleDailyRun(): Promise<void> {
    try {
      const result = await this.runDue();
      this.logger.log(`Schedule run: ${JSON.stringify(result)}`);
    } catch (error: any) {
      this.logger.error(`Schedule run failed: ${error?.message ?? error}`);
    }
  }

  async runDue(): Promise<{
    processed: number;
    credited: number;
    skipped: number;
    failures: number;
  }> {
    const assignments = await this.dueAssignments();
    let credited = 0;
    let skipped = 0;
    let failures = 0;
    for (const assignment of assignments) {
      const outcome = await this.payAssignment(assignment);
      if (outcome === 'credited') credited += 1;
      else if (outcome === 'skipped') skipped += 1;
      else failures += 1;
    }
    return { processed: assignments.length, credited, skipped, failures };
  }

  private async dueAssignments(): Promise<AssignmentRow[]> {
    const result = await this.hasura.executeQuery(DUE_ASSIGNMENTS, {});
    return result.payment_schedule_assignments ?? [];
  }

  private async payAssignment(assignment: AssignmentRow): Promise<'credited' | 'skipped' | 'failed'> {
    const period = currentPeriod(
      new Date(assignment.starts_at),
      assignment.schedule.frequency,
      new Date(),
      assignment.ends_at ? new Date(assignment.ends_at) : null
    );
    if (!period) return 'skipped';
    if (await this.runExists(assignment.id, period.start)) return 'skipped';
    const claimed = await this.claimRun(assignment, period);
    if (!claimed) return 'skipped';
    return this.postLegs(assignment, period, claimed);
  }

  private async runExists(assignmentId: string, start: Date): Promise<boolean> {
    const result = await this.hasura.executeQuery(RUN_EXISTS, {
      assignmentId,
      periodStart: start.toISOString(),
    });
    return (result.payment_schedule_runs?.length ?? 0) > 0;
  }

  private async claimRun(
    assignment: AssignmentRow,
    period: { start: Date; end: Date }
  ): Promise<string | null> {
    try {
      const result = await this.hasura.executeMutation(INSERT_RUN, {
        object: {
          assignment_id: assignment.id,
          period_start: period.start.toISOString(),
          period_end: period.end.toISOString(),
          amount: assignment.amount,
          status: 'failed',
          failure_reason: 'pending',
        },
      });
      return result.insert_payment_schedule_runs_one?.id ?? null;
    } catch {
      return null;
    }
  }

  private async postLegs(
    assignment: AssignmentRow,
    period: { start: Date; end: Date },
    runId: string
  ): Promise<'credited' | 'failed'> {
    const label = `${assignment.schedule.name} - ${period.start.toISOString().slice(0, 10)}`;
    const hq = await this.hqAccount(assignment.currency);
    if (!hq) return this.failRun(runId, 'Rendasua HQ account missing');
    const debit = await this.accounts.registerTransaction({
      accountId: hq.id,
      amount: Number(assignment.amount),
      transactionType: 'payment',
      memo: `Scheduled payment source - ${label}`,
      allowNegative: true,
    });
    if (!debit.success) return this.failRun(runId, debit.error || 'HQ debit failed');
    const agentAccount = await this.personalAccount(assignment.agent.user_id, assignment.currency);
    const credit = agentAccount
      ? await this.accounts.registerTransaction({
          accountId: agentAccount.id,
          amount: Number(assignment.amount),
          transactionType: 'deposit',
          memo: `Scheduled payment - ${label}`,
        })
      : { success: false, error: 'Agent wallet missing' };
    if (!credit.success) {
      await this.reverseHq(hq.id, Number(assignment.amount), label);
      return this.failRun(runId, credit.error || 'Agent credit failed');
    }
    await this.markPosted(runId, debit.transactionId, credit.transactionId);
    await this.notifyAgent(assignment, label);
    return 'credited';
  }

  private async failRun(runId: string, reason: string): Promise<'failed'> {
    await this.hasura.executeMutation(UPDATE_RUN, {
      id: runId,
      status: 'failed',
      reason,
      hqId: null,
      agentId: null,
    });
    return 'failed';
  }

  private async markPosted(runId: string, hqId?: string, agentId?: string): Promise<void> {
    await this.hasura.executeMutation(UPDATE_RUN, {
      id: runId,
      status: 'posted',
      reason: null,
      hqId: hqId ?? null,
      agentId: agentId ?? null,
    });
  }

  private async reverseHq(accountId: string, amount: number, label: string): Promise<void> {
    await this.accounts.registerTransaction({
      accountId,
      amount,
      transactionType: 'deposit',
      memo: `Scheduled payment reversal - ${label}`,
    });
  }

  private async hqAccount(currency: string) {
    const result = await this.hasura.executeQuery(HQ_ACCOUNT, { currency });
    return result.users?.[0]?.accounts?.[0] ?? null;
  }

  private async personalAccount(userId: string, currency: string) {
    const result = await this.hasura.executeQuery(PERSONAL_ACCOUNT, { userId, currency });
    return result.accounts?.[0] ?? null;
  }

  private async notifyAgent(assignment: AssignmentRow, label: string): Promise<void> {
    const copy = scheduleCreditCopy({
      amount: Number(assignment.amount),
      currency: assignment.currency,
      name: label,
      preferredLanguage: assignment.agent.user?.preferred_language,
    });
    await this.notifications.sendPaymentProgramNotice({
      userId: assignment.agent.user_id,
      title: copy.title,
      body: copy.body,
      messageType: 'PAYMENT_SCHEDULE',
      entityId: assignment.id,
      path: '/accounts/schedules',
      event: 'wallet.schedule_credit',
    });
  }
}

const DUE_ASSIGNMENTS = `
  query DueScheduleAssignments {
    payment_schedule_assignments(where: {
      status: { _eq: active }
      schedule: { is_active: { _eq: true } }
    }) {
      id amount currency starts_at ends_at
      schedule { name frequency }
      agent { user_id user { preferred_language } }
    }
  }
`;

const RUN_EXISTS = `
  query ScheduleRunExists($assignmentId: uuid!, $periodStart: timestamptz!) {
    payment_schedule_runs(where: {
      assignment_id: { _eq: $assignmentId }
      period_start: { _eq: $periodStart }
    }, limit: 1) { id }
  }
`;

const INSERT_RUN = `
  mutation ClaimScheduleRun($object: payment_schedule_runs_insert_input!) {
    insert_payment_schedule_runs_one(object: $object) { id }
  }
`;

const UPDATE_RUN = `
  mutation UpdateScheduleRun(
    $id: uuid!
    $status: payment_schedule_run_status!
    $reason: String
    $hqId: uuid
    $agentId: uuid
  ) {
    update_payment_schedule_runs_by_pk(
      pk_columns: { id: $id }
      _set: {
        status: $status
        failure_reason: $reason
        hq_transaction_id: $hqId
        agent_transaction_id: $agentId
      }
    ) { id }
  }
`;

const HQ_ACCOUNT = `
  query HqAccount($currency: currency_enum!) {
    users(where: { email: { _eq: "hq@rendasua.com" } }, limit: 1) {
      accounts(where: {
        currency: { _eq: $currency }
        business_location_id: { _is_null: true }
      }, limit: 1) { id }
    }
  }
`;

const PERSONAL_ACCOUNT = `
  query AgentPersonalAccount($userId: uuid!, $currency: currency_enum!) {
    accounts(where: {
      user_id: { _eq: $userId }
      currency: { _eq: $currency }
      business_location_id: { _is_null: true }
    }, limit: 1) { id }
  }
`;
