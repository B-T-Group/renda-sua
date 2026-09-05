import { OrderRiskAlertService } from './order-risk-alert.service';
import type { RaisedIncident } from './order-risk-incidents.service';
import {
  DEFAULT_ORDER_RISK_CONFIG,
  type OrderRiskFinding,
  type OrderRiskIncident,
  type OrderRiskSeverity,
} from './order-risk.types';

function makeIncident(
  overrides: Partial<OrderRiskIncident> = {}
): OrderRiskIncident {
  return {
    id: 'incident-1',
    order_id: 'order-1',
    risk_type: 'pickup_overdue',
    severity: 'warning',
    detected_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    resolved_at: null,
    resolution: null,
    due_at: null,
    overdue_minutes: 20,
    context: {},
    last_notified_at: null,
    last_notified_severity: null,
    notified_count: 0,
    acknowledged_at: null,
    acknowledged_by: null,
    acknowledged_note: null,
    ...overrides,
  };
}

function makeFinding(severity: OrderRiskSeverity = 'warning'): OrderRiskFinding {
  return {
    riskType: 'pickup_overdue',
    severity,
    overdueMinutes: 20,
    dueAt: null,
    reason: 'Agent has not picked up',
  };
}

function setup(attempts: Array<{ channel: string; status: string }> = [
  { channel: 'push', status: 'sent' },
]) {
  const notifications = {
    notifyOpsOrderRisk: jest.fn().mockResolvedValue(attempts),
  };
  const incidents = {
    recordAlertAttempt: jest.fn().mockResolvedValue(undefined),
  };
  const events = { recordEvent: jest.fn().mockResolvedValue(undefined) };
  const context = { load: jest.fn().mockResolvedValue(undefined) };
  const service = new OrderRiskAlertService(
    notifications as never,
    incidents as never,
    events as never,
    context as never
  );
  return { service, notifications, incidents, events, context };
}

function raised(overrides: Partial<RaisedIncident> = {}): RaisedIncident {
  return {
    incident: makeIncident(),
    isNew: true,
    escalated: false,
    ...overrides,
  };
}

describe('OrderRiskAlertService', () => {
  it('alerts superusers when an incident first opens', async () => {
    const { service, notifications, incidents } = setup();
    const sent = await service.alertIfDue({
      orderId: 'order-1',
      orderNumber: 'ORD-1',
      raised: raised(),
      finding: makeFinding(),
      config: DEFAULT_ORDER_RISK_CONFIG,
    });
    expect(sent).toBe(true);
    expect(notifications.notifyOpsOrderRisk).toHaveBeenCalledTimes(1);
    expect(incidents.recordAlertAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        incidentId: 'incident-1',
        severity: 'warning',
        delivered: true,
      })
    );
  });

  it('does not start the cooldown when no channel delivered', async () => {
    const { service, incidents, events } = setup([
      { channel: 'push', status: 'failed' },
      { channel: 'whatsapp', status: 'skipped' },
    ]);
    const sent = await service.alertIfDue({
      orderId: 'order-1',
      orderNumber: 'ORD-1',
      raised: raised(),
      finding: makeFinding(),
      config: DEFAULT_ORDER_RISK_CONFIG,
    });
    expect(sent).toBe(false);
    expect(incidents.recordAlertAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ delivered: false })
    );
    expect(events.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ delivered: false }),
      })
    );
  });

  it('does not start the cooldown when there are no superuser recipients', async () => {
    const { service, incidents } = setup([]);
    const sent = await service.alertIfDue({
      orderId: 'order-1',
      orderNumber: 'ORD-1',
      raised: raised(),
      finding: makeFinding(),
      config: DEFAULT_ORDER_RISK_CONFIG,
    });
    expect(sent).toBe(false);
    expect(incidents.recordAlertAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ delivered: false })
    );
  });

  it('does not alert when alerting is disabled', async () => {
    const { service, notifications } = setup();
    const sent = await service.alertIfDue({
      orderId: 'order-1',
      orderNumber: 'ORD-1',
      raised: raised(),
      finding: makeFinding(),
      config: { ...DEFAULT_ORDER_RISK_CONFIG, alertsEnabled: false },
    });
    expect(sent).toBe(false);
    expect(notifications.notifyOpsOrderRisk).not.toHaveBeenCalled();
  });

  it('suppresses warnings when only critical incidents should alert', async () => {
    const { service, notifications } = setup();
    const sent = await service.alertIfDue({
      orderId: 'order-1',
      orderNumber: 'ORD-1',
      raised: raised(),
      finding: makeFinding('warning'),
      config: { ...DEFAULT_ORDER_RISK_CONFIG, minSeverity: 'critical' },
    });
    expect(sent).toBe(false);
    expect(notifications.notifyOpsOrderRisk).not.toHaveBeenCalled();
  });

  it('does not re-alert an open incident inside the repeat cooldown', async () => {
    const { service, notifications } = setup();
    const sent = await service.alertIfDue({
      orderId: 'order-1',
      orderNumber: 'ORD-1',
      raised: raised({
        isNew: false,
        incident: makeIncident({
          last_notified_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          last_notified_severity: 'warning',
        }),
      }),
      finding: makeFinding(),
      config: DEFAULT_ORDER_RISK_CONFIG,
    });
    expect(sent).toBe(false);
    expect(notifications.notifyOpsOrderRisk).not.toHaveBeenCalled();
  });

  it('re-alerts once the repeat cooldown has elapsed', async () => {
    const { service, notifications } = setup();
    const sent = await service.alertIfDue({
      orderId: 'order-1',
      orderNumber: 'ORD-1',
      raised: raised({
        isNew: false,
        incident: makeIncident({
          last_notified_at: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
          last_notified_severity: 'warning',
        }),
      }),
      finding: makeFinding(),
      config: DEFAULT_ORDER_RISK_CONFIG,
    });
    expect(sent).toBe(true);
    expect(notifications.notifyOpsOrderRisk).toHaveBeenCalledTimes(1);
  });

  it('alerts immediately on escalation even inside the cooldown', async () => {
    const { service, notifications } = setup();
    const sent = await service.alertIfDue({
      orderId: 'order-1',
      orderNumber: 'ORD-1',
      raised: raised({
        isNew: false,
        escalated: true,
        incident: makeIncident({
          last_notified_at: new Date().toISOString(),
          last_notified_severity: 'warning',
        }),
      }),
      finding: makeFinding('critical'),
      config: DEFAULT_ORDER_RISK_CONFIG,
    });
    expect(sent).toBe(true);
    expect(notifications.notifyOpsOrderRisk).toHaveBeenCalledTimes(1);
  });

  it('stops repeat alerts once staff acknowledged the incident', async () => {
    const { service, notifications } = setup();
    const sent = await service.alertIfDue({
      orderId: 'order-1',
      orderNumber: 'ORD-1',
      raised: raised({
        isNew: false,
        incident: makeIncident({
          acknowledged_at: new Date().toISOString(),
          last_notified_at: new Date(Date.now() - 300 * 60 * 1000).toISOString(),
          last_notified_severity: 'warning',
        }),
      }),
      finding: makeFinding(),
      config: DEFAULT_ORDER_RISK_CONFIG,
    });
    expect(sent).toBe(false);
    expect(notifications.notifyOpsOrderRisk).not.toHaveBeenCalled();
  });
});
