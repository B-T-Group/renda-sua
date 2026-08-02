import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export interface PickupOpsHealthRow {
  id: string;
  order_number: string;
  pickup_state: string | null;
  pickup_due_at: string | null;
  assigned_at: string | null;
  reassignment_count: number | null;
  business?: { name?: string | null } | null;
  assigned_agent?: {
    user?: { first_name?: string | null; last_name?: string | null } | null;
  } | null;
  displayHealth: string;
}

export interface PickupKpis {
  assignedLiveCount: number;
  byState: Record<string, number>;
  reminderCount: number;
  atRiskCount: number;
  overdueCount: number;
  reassignmentStartedCount: number;
  reassignedCount: number;
  customerDelayNotifications: number;
  merchantDelayCount: number;
  slaComplianceRate: number | null;
  averagePickupDelayMinutes: number | null;
  reassignmentRate: number | null;
}

@Injectable()
export class OrderPickupAnalyticsService {
  constructor(private readonly hasura: HasuraSystemService) {}

  async getOperationalHealth(limit = 50): Promise<{
    orders: PickupOpsHealthRow[];
  }> {
    const res = await this.hasura.executeQuery(
      `query PickupHealth($limit: Int!) {
        orders(
          where: {
            current_status: { _eq: assigned_to_agent }
            pickup_state: { _is_null: false }
          }
          order_by: { pickup_due_at: asc_nulls_last }
          limit: $limit
        ) {
          id order_number pickup_state pickup_due_at assigned_at
          reassignment_count last_agent_distance_m agent_arrived_pickup_at
          business { name }
          assigned_agent { user { first_name last_name } }
        }
      }`,
      { limit: Math.min(Math.max(limit, 1), 200) }
    );
    const orders = (res.orders || []).map((row: any) => ({
      ...row,
      displayHealth: this.computeDisplayHealth(row),
    }));
    return { orders };
  }

  async getPickupKpis(sinceIso?: string): Promise<PickupKpis> {
    const since =
      sinceIso ||
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [live, events, completed] = await Promise.all([
      this.countLiveByState(),
      this.countEvents(since),
      this.completedPickupStats(since),
    ]);
    const assignments = events.agent_assigned || 0;
    const reassignments = events.reassignment_started || 0;
    return {
      assignedLiveCount: live.total,
      byState: live.byState,
      reminderCount: events.pickup_reminder_sent || 0,
      atRiskCount: events.pickup_at_risk || 0,
      overdueCount: events.pickup_overdue || 0,
      reassignmentStartedCount: reassignments,
      reassignedCount: events.reassigned || 0,
      customerDelayNotifications: events.customer_notified_delay || 0,
      merchantDelayCount: events.merchant_delay_started || 0,
      slaComplianceRate: completed.slaComplianceRate,
      averagePickupDelayMinutes: completed.averagePickupDelayMinutes,
      reassignmentRate:
        assignments > 0
          ? Math.round((reassignments / assignments) * 1000) / 10
          : null,
    };
  }

  private computeDisplayHealth(row: {
    pickup_state?: string | null;
    pickup_due_at?: string | null;
    agent_arrived_pickup_at?: string | null;
  }): string {
    if (row.agent_arrived_pickup_at) return 'Recovering';
    switch (row.pickup_state) {
      case 'overdue':
        return 'Overdue';
      case 'at_risk':
        return 'At Risk';
      case 'reminded':
        return 'Approaching SLA';
      case 'paused':
        return 'Paused';
      case 'reassigning':
        return 'Reassigning';
      default:
        return this.isApproachingDue(row.pickup_due_at)
          ? 'Approaching SLA'
          : 'Healthy';
    }
  }

  private isApproachingDue(dueAt?: string | null): boolean {
    if (!dueAt) return false;
    const ms = new Date(dueAt).getTime() - Date.now();
    return ms > 0 && ms <= 5 * 60 * 1000;
  }

  private async countLiveByState(): Promise<{
    total: number;
    byState: Record<string, number>;
  }> {
    const res = await this.hasura.executeQuery(
      `query LivePickup {
        orders(
          where: {
            current_status: { _eq: assigned_to_agent }
            pickup_state: { _is_null: false }
          }
        ) { pickup_state }
      }`
    );
    const byState: Record<string, number> = {};
    for (const row of res.orders || []) {
      const key = row.pickup_state || 'unknown';
      byState[key] = (byState[key] || 0) + 1;
    }
    return { total: (res.orders || []).length, byState };
  }

  private async countEvents(
    since: string
  ): Promise<Record<string, number>> {
    const res = await this.hasura.executeQuery(
      `query PickupEvents($since: timestamptz!) {
        order_events(
          where: {
            created_at: { _gte: $since }
            event_type: {
              _in: [
                "agent_assigned",
                "pickup_reminder_sent",
                "pickup_at_risk",
                "pickup_overdue",
                "reassignment_started",
                "reassigned",
                "customer_notified_delay",
                "merchant_delay_started"
              ]
            }
          }
        ) { event_type }
      }`,
      { since }
    );
    const counts: Record<string, number> = {};
    for (const row of res.order_events || []) {
      counts[row.event_type] = (counts[row.event_type] || 0) + 1;
    }
    return counts;
  }

  private async completedPickupStats(since: string): Promise<{
    slaComplianceRate: number | null;
    averagePickupDelayMinutes: number | null;
  }> {
    const res = await this.hasura.executeQuery(
      `query CompletedPickups($since: timestamptz!) {
        order_status_history(
          where: {
            status: { _eq: picked_up }
            created_at: { _gte: $since }
          }
          limit: 500
        ) {
          order_id
          created_at
          order { pickup_due_at assigned_at }
        }
      }`,
      { since }
    );
    const rows = res.order_status_history || [];
    if (!rows.length) {
      return { slaComplianceRate: null, averagePickupDelayMinutes: null };
    }
    let onTime = 0;
    let delaySum = 0;
    let delayCount = 0;
    for (const row of rows) {
      const due = row.order?.pickup_due_at;
      if (!due) continue;
      const picked = new Date(row.created_at).getTime();
      const dueMs = new Date(due).getTime();
      if (picked <= dueMs) onTime += 1;
      else {
        delaySum += (picked - dueMs) / 60000;
        delayCount += 1;
      }
    }
    const withDue = rows.filter((r: any) => r.order?.pickup_due_at).length;
    return {
      slaComplianceRate:
        withDue > 0 ? Math.round((onTime / withDue) * 1000) / 10 : null,
      averagePickupDelayMinutes:
        delayCount > 0
          ? Math.round((delaySum / delayCount) * 10) / 10
          : null,
    };
  }
}
