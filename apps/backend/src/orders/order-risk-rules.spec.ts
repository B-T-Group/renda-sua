import { DateTime } from 'luxon';
import { evaluateOrderRisk } from './order-risk-rules';
import {
  DEFAULT_ORDER_RISK_CONFIG,
  type OrderRiskType,
  type RiskEvaluableOrder,
} from './order-risk.types';

const NOW = DateTime.fromISO('2026-08-26T12:00:00.000Z', { zone: 'utc' });

function minutesAgo(minutes: number): string {
  return NOW.minus({ minutes }).toISO() as string;
}

function minutesAhead(minutes: number): string {
  return NOW.plus({ minutes }).toISO() as string;
}

function evaluate(order: Partial<RiskEvaluableOrder>): OrderRiskType[] {
  const findings = evaluateOrderRisk(
    { id: 'order-1', current_status: 'pending', ...order } as RiskEvaluableOrder,
    DEFAULT_ORDER_RISK_CONFIG,
    NOW
  );
  return findings.map((finding) => finding.riskType);
}

describe('evaluateOrderRisk — pending acceptance', () => {
  it('flags a pending order past its acceptance deadline plus grace', () => {
    expect(
      evaluate({
        current_status: 'pending',
        acceptance_deadline_at: minutesAgo(20),
      })
    ).toEqual(['pending_acceptance']);
  });

  it('stays quiet inside the grace window after the deadline', () => {
    expect(
      evaluate({
        current_status: 'pending',
        acceptance_deadline_at: minutesAgo(3),
      })
    ).toEqual([]);
  });

  it('stays quiet before the deadline even for an old order', () => {
    expect(
      evaluate({
        current_status: 'pending',
        created_at: minutesAgo(240),
        acceptance_deadline_at: minutesAhead(30),
      })
    ).toEqual([]);
  });

  it('falls back to order age when no acceptance deadline exists', () => {
    expect(
      evaluate({ current_status: 'pending', created_at: minutesAgo(60) })
    ).toEqual(['pending_acceptance']);
    expect(
      evaluate({ current_status: 'pending', created_at: minutesAgo(10) })
    ).toEqual([]);
  });

  it('ignores a scheduled order whose start time has not arrived', () => {
    expect(
      evaluate({
        current_status: 'pending',
        acceptance_state: 'scheduled',
        acceptance_activates_at: minutesAhead(120),
        created_at: minutesAgo(600),
      })
    ).toEqual([]);
  });

  it('flags a scheduled order whose activation never fired', () => {
    const [finding] = evaluateOrderRisk(
      {
        id: 'order-1',
        current_status: 'pending',
        acceptance_state: 'scheduled',
        acceptance_activates_at: minutesAgo(90),
      } as RiskEvaluableOrder,
      DEFAULT_ORDER_RISK_CONFIG,
      NOW
    );
    expect(finding.riskType).toBe('pending_acceptance');
    // Lateness is measured from the start time itself, not from the grace window,
    // because operators read this string straight off the push notification.
    expect(finding.reason).toContain('1h 30min ago');
  });

  it('flags the order the moment the merchant enters grace', () => {
    // Grace is the last window before auto-decline, so waiting for
    // grace_deadline_at would only surface an order already cancelled.
    expect(
      evaluate({
        current_status: 'pending',
        acceptance_state: 'grace',
        acceptance_deadline_at: minutesAgo(15),
        grace_deadline_at: minutesAhead(5),
      })
    ).toEqual(['pending_acceptance']);
  });

  it('flags a grace order whose deadline only just fired', () => {
    const [finding] = evaluateOrderRisk(
      {
        id: 'order-1',
        current_status: 'pending',
        acceptance_state: 'grace',
        acceptance_deadline_at: NOW.toISO() as string,
        grace_deadline_at: minutesAhead(5),
      } as RiskEvaluableOrder,
      DEFAULT_ORDER_RISK_CONFIG,
      NOW
    );
    expect(finding.riskType).toBe('pending_acceptance');
    expect(finding.overdueMinutes).toBe(0);
  });

  it('measures grace lateness from the acceptance deadline', () => {
    const [finding] = evaluateOrderRisk(
      {
        id: 'order-1',
        current_status: 'pending',
        acceptance_state: 'no_response',
        acceptance_deadline_at: minutesAgo(120),
        grace_deadline_at: minutesAgo(20),
      } as RiskEvaluableOrder,
      DEFAULT_ORDER_RISK_CONFIG,
      NOW
    );
    expect(finding.overdueMinutes).toBe(120);
    expect(finding.reason).toContain('2h 0min');
  });
});

describe('evaluateOrderRisk — confirmed but not prepared', () => {
  it('flags a confirmed order past its promised ready time', () => {
    expect(
      evaluate({
        current_status: 'confirmed',
        promised_ready_at: minutesAgo(30),
      })
    ).toEqual(['prep_overdue']);
  });

  it('falls back to accepted_at when no ready promise exists', () => {
    expect(
      evaluate({ current_status: 'preparing', accepted_at: minutesAgo(90) })
    ).toEqual(['prep_overdue']);
    expect(
      evaluate({ current_status: 'preparing', accepted_at: minutesAgo(20) })
    ).toEqual([]);
  });

  it('falls back to time in status when the order was never accepted', () => {
    expect(
      evaluate({
        current_status: 'preparing',
        status_changed_at: minutesAgo(90),
      })
    ).toEqual(['prep_overdue']);
  });

  it('stays quiet before the promised ready time', () => {
    expect(
      evaluate({
        current_status: 'confirmed',
        promised_ready_at: minutesAhead(15),
        accepted_at: minutesAgo(300),
      })
    ).toEqual([]);
  });
});

describe('evaluateOrderRisk — ready but unassigned', () => {
  it('flags a delivery order sitting ready with no agent', () => {
    expect(
      evaluate({
        current_status: 'ready_for_pickup',
        fulfillment_method: 'delivery',
        status_changed_at: minutesAgo(45),
      })
    ).toEqual(['ready_unassigned']);
  });

  it('measures time in status, not the last row write', () => {
    expect(
      evaluate({
        current_status: 'ready_for_pickup',
        fulfillment_method: 'delivery',
        status_changed_at: minutesAgo(120),
        updated_at: minutesAgo(1),
      })
    ).toEqual(['ready_unassigned']);
  });

  it('does not flag once an agent is assigned', () => {
    expect(
      evaluate({
        current_status: 'ready_for_pickup',
        fulfillment_method: 'delivery',
        assigned_agent_id: 'agent-1',
        status_changed_at: minutesAgo(600),
      })
    ).toEqual([]);
  });

  it('respects the threshold boundary', () => {
    expect(
      evaluate({
        current_status: 'ready_for_pickup',
        fulfillment_method: 'delivery',
        status_changed_at: minutesAgo(30),
      })
    ).toEqual([]);
  });

  it('goes straight to critical once dispatch is exhausted', () => {
    const [finding] = evaluateOrderRisk(
      {
        id: 'order-1',
        current_status: 'ready_for_pickup',
        fulfillment_method: 'delivery',
        status_changed_at: minutesAgo(45),
        dispatch_exhausted_at: minutesAgo(5),
      } as RiskEvaluableOrder,
      DEFAULT_ORDER_RISK_CONFIG,
      NOW
    );
    expect(finding.severity).toBe('critical');
  });
});

describe('evaluateOrderRisk — ready but never collected', () => {
  it('flags a store pickup order nobody came for', () => {
    expect(
      evaluate({
        current_status: 'ready_for_pickup',
        fulfillment_method: 'pickup',
        status_changed_at: minutesAgo(800),
      })
    ).toEqual(['pickup_uncollected']);
  });

  it('covers shipping orders waiting on a carrier handoff', () => {
    expect(
      evaluate({
        current_status: 'ready_for_pickup',
        fulfillment_method: 'shipping',
        status_changed_at: minutesAgo(800),
      })
    ).toEqual(['pickup_uncollected']);
  });

  it('gives the customer the full collection window first', () => {
    expect(
      evaluate({
        current_status: 'ready_for_pickup',
        fulfillment_method: 'pickup',
        status_changed_at: minutesAgo(120),
      })
    ).toEqual([]);
  });

  it('never raises the agent dispatch risk for a pickup order', () => {
    expect(
      evaluate({
        current_status: 'ready_for_pickup',
        fulfillment_method: 'pickup',
        status_changed_at: minutesAgo(5000),
      })
    ).not.toContain('ready_unassigned');
  });
});

describe('evaluateOrderRisk — assigned but not collected', () => {
  it('flags an assigned order past pickup due plus grace', () => {
    expect(
      evaluate({
        current_status: 'assigned_to_agent',
        pickup_due_at: minutesAgo(25),
      })
    ).toEqual(['pickup_overdue']);
  });

  it('does not flag when the agent already arrived at pickup', () => {
    expect(
      evaluate({
        current_status: 'assigned_to_agent',
        pickup_due_at: minutesAgo(120),
        agent_arrived_pickup_at: minutesAgo(90),
      })
    ).toEqual([]);
  });

  it('does not flag while pickup monitoring is paused', () => {
    expect(
      evaluate({
        current_status: 'assigned_to_agent',
        pickup_due_at: minutesAgo(120),
        pickup_state: 'paused',
      })
    ).toEqual([]);
  });
});

describe('evaluateOrderRisk — delivery running late', () => {
  it('flags a delivery past its ETA', () => {
    expect(
      evaluate({
        current_status: 'out_for_delivery',
        estimated_delivery_time: minutesAgo(20),
        status_changed_at: minutesAgo(30),
      })
    ).toEqual(['delivery_delayed']);
  });

  it('flags a long delivery with no promise at all', () => {
    expect(
      evaluate({ current_status: 'in_transit', status_changed_at: minutesAgo(90) })
    ).toEqual(['delivery_delayed']);
  });

  it('does not let agent progress writes reset the no-promise clock', () => {
    expect(
      evaluate({
        current_status: 'in_transit',
        status_changed_at: minutesAgo(180),
        updated_at: minutesAgo(1),
      })
    ).toEqual(['delivery_delayed']);
  });

  it('uses the delivery window end when it is the soonest promise', () => {
    expect(
      evaluate({
        current_status: 'out_for_delivery',
        status_changed_at: minutesAgo(5),
        delivery_time_window: {
          preferred_date: '2026-08-26',
          time_slot_end: '10:00:00',
        },
      })
    ).toEqual(['delivery_delayed']);
  });

  it('stays quiet before the promised arrival', () => {
    expect(
      evaluate({
        current_status: 'out_for_delivery',
        estimated_delivery_time: minutesAhead(20),
        status_changed_at: minutesAgo(10),
      })
    ).toEqual([]);
  });
});

describe('evaluateOrderRisk — severity', () => {
  it('escalates to critical past the configured critical threshold', () => {
    const [finding] = evaluateOrderRisk(
      {
        id: 'order-1',
        current_status: 'assigned_to_agent',
        pickup_due_at: minutesAgo(120),
      } as RiskEvaluableOrder,
      DEFAULT_ORDER_RISK_CONFIG,
      NOW
    );
    expect(finding.severity).toBe('critical');
  });

  it('stays a warning just after the threshold is crossed', () => {
    const [finding] = evaluateOrderRisk(
      {
        id: 'order-1',
        current_status: 'assigned_to_agent',
        pickup_due_at: minutesAgo(20),
      } as RiskEvaluableOrder,
      DEFAULT_ORDER_RISK_CONFIG,
      NOW
    );
    expect(finding.severity).toBe('warning');
  });
});
