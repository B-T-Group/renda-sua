import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderEventsService } from './order-events.service';
import { OrderRiskContextService } from './order-risk-context.service';
import type { RaisedIncident } from './order-risk-incidents.service';
import { OrderRiskIncidentsService } from './order-risk-incidents.service';
import {
  severityRank,
  type OrderRiskConfig,
  type OrderRiskFinding,
} from './order-risk.types';

@Injectable()
export class OrderRiskAlertService {
  private readonly logger = new Logger(OrderRiskAlertService.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly incidents: OrderRiskIncidentsService,
    private readonly events: OrderEventsService,
    private readonly context: OrderRiskContextService
  ) {}

  /**
   * Sends the ops alert for a raised incident when it is new, has escalated,
   * or has gone unresolved past the repeat cooldown.
   */
  async alertIfDue(params: {
    orderId: string;
    orderNumber: string;
    raised: RaisedIncident;
    finding: OrderRiskFinding;
    config: OrderRiskConfig;
  }): Promise<boolean> {
    const { raised, finding, config } = params;
    if (!this.shouldAlert(raised, finding, config)) return false;
    try {
      return await this.deliver(params);
    } catch (error: any) {
      this.logger.error(
        `alertIfDue failed for order ${params.orderId}: ${error?.message}`
      );
      return false;
    }
  }

  /** Returns true only when at least one ops channel actually went out. */
  private async deliver(params: {
    orderId: string;
    orderNumber: string;
    raised: RaisedIncident;
    finding: OrderRiskFinding;
  }): Promise<boolean> {
    const { raised, finding } = params;
    const attempts = await this.notifications.notifyOpsOrderRisk({
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      riskType: finding.riskType,
      severity: finding.severity,
      reason: finding.reason,
      incidentId: raised.incident.id,
      action: await this.context.load(params.orderId),
    });
    const delivered = attempts.some(
      (attempt) => attempt.status === 'sent' || attempt.status === 'delivered'
    );
    await this.incidents.recordAlertAttempt({
      incidentId: raised.incident.id,
      severity: finding.severity,
      channels: attempts,
      delivered,
    });
    if (!delivered) {
      this.logger.warn(
        `No ops channel delivered for incident ${raised.incident.id} (order ${params.orderId}); will retry next sweep`
      );
    }
    await this.events.recordEvent({
      orderId: params.orderId,
      eventType: raised.isNew ? 'risk_incident_opened' : 'risk_superusers_alerted',
      actorType: 'system',
      payload: {
        incidentId: raised.incident.id,
        riskType: finding.riskType,
        severity: finding.severity,
        reason: finding.reason,
        attempts: attempts.length,
        delivered,
      },
    });
    return delivered;
  }

  private shouldAlert(
    raised: RaisedIncident,
    finding: OrderRiskFinding,
    config: OrderRiskConfig
  ): boolean {
    if (!config.alertsEnabled) return false;
    if (severityRank(finding.severity) < severityRank(config.minSeverity)) {
      return false;
    }
    if (raised.escalated) return true;
    // Staff already picked this up; only an escalation is worth interrupting them.
    if (raised.incident.acknowledged_at) return false;
    if (raised.isNew || !raised.incident.last_notified_at) return true;
    return this.cooldownElapsed(
      raised.incident.last_notified_at,
      config.alertRepeatMinutes
    );
  }

  private cooldownElapsed(lastNotifiedAt: string, repeatMinutes: number): boolean {
    if (repeatMinutes <= 0) return false;
    const elapsedMs = Date.now() - new Date(lastNotifiedAt).getTime();
    return elapsedMs >= repeatMinutes * 60 * 1000;
  }
}
