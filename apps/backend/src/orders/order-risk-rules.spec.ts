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
      evaluate({ current_status: 'pending', created_at: minutesAgo(45) })
    ).toEqual(['pending_acceptance']);
    expect(
      evaluate({ current_status: 'pending', created_at: minutesAgo(10) })
    ).toEqual([]);
  });

  it('ignores scheduled orders that are intentionally still pending', () => {
    expect(
      evaluate({
        current_status: 'pending',
        acceptance_state: 'scheduled',
        acceptance_deadline_at: minutesAgo(120),
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
        updated_at: minutesAgo(45),
      })
    ).toEqual(['ready_unassigned']);
  });

  it('does not flag a store pickup order', () => {
    expect(
      evaluate({
        current_status: 'ready_for_pickup',
        fulfillment_method: 'pickup',
        updated_at: minutesAgo(600),
      })
    ).toEqual([]);
  });

  it('does not flag once an agent is assigned', () => {
    expect(
      evaluate({
        current_status: 'ready_for_pickup',
        fulfillment_method: 'delivery',
        assigned_agent_id: 'agent-1',
        updated_at: minutesAgo(600),
      })
    ).toEqual([]);
  });

  it('respects the threshold boundary', () => {
    expect(
      evaluate({
        current_status: 'ready_for_pickup',
        fulfillment_method: 'delivery',
        updated_at: minutesAgo(30),
      })
    ).toEqual([]);
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
        updated_at: minutesAgo(30),
      })
    ).toEqual(['delivery_delayed']);
  });

  it('flags a long delivery with no promise at all', () => {
    expect(
      evaluate({ current_status: 'in_transit', updated_at: minutesAgo(90) })
    ).toEqual(['delivery_delayed']);
  });

  it('uses the delivery window end when it is the soonest promise', () => {
    expect(
      evaluate({
        current_status: 'out_for_delivery',
        updated_at: minutesAgo(5),
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
        updated_at: minutesAgo(10),
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
