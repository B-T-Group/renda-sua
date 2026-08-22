import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';

export interface OrderWithRisk {
  risk_score: number;
  risk_factors: string[];
  [key: string]: any;
}

export enum RiskLevel {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export interface RiskFactor {
  factor: string;
  score: number;
}

/** Statuses that should progress; long dwell time is a risk signal. */
const STUCK_STATUSES = new Set([
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'assigned_to_agent',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'awaiting_shipment',
  'shipped',
  'in_delivery',
]);

@Injectable()
export class OrderRiskService {
  calculateRiskScore(order: any): { score: number; factors: string[] } {
    if (!order.current_status) {
      return { score: 0, factors: [] };
    }

    const now = DateTime.utc();
    const factors: RiskFactor[] = [
      ...this.pendingConfirmationFactors(order, now),
      ...this.acceptanceDeadlineFactors(order, now),
      ...this.pickupStateFactors(order),
      ...this.deliveryWindowFactors(order, now),
      ...this.agentPickupFactors(order, now),
      ...this.estimatedDeliveryFactors(order, now),
      ...this.stuckStatusFactors(order, now),
    ];

    const totalScore = factors.reduce((sum, f) => sum + f.score, 0);
    return {
      score: Math.min(100, Math.round(totalScore)),
      factors: factors.map((f) => f.factor),
    };
  }

  getRiskLevel(score: number): RiskLevel {
    if (score >= 50) return RiskLevel.CRITICAL;
    if (score >= 30) return RiskLevel.HIGH;
    if (score >= 15) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }

  enrichOrderWithRisk(order: any): OrderWithRisk {
    const { score, factors } = this.calculateRiskScore(order);
    return {
      ...order,
      risk_score: score,
      risk_factors: factors,
    };
  }

  private pendingConfirmationFactors(
    order: any,
    now: DateTime
  ): RiskFactor[] {
    if (order.current_status !== 'pending' || !order.created_at) return [];
    const minutes = now.diff(DateTime.fromISO(order.created_at), 'minutes')
      .minutes;
    if (minutes <= 30) return [];
    return [
      {
        factor: `Not confirmed for ${Math.round(minutes)} minutes`,
        score: Math.min(30, minutes),
      },
    ];
  }

  private acceptanceDeadlineFactors(
    order: any,
    now: DateTime
  ): RiskFactor[] {
    if (
      !order.acceptance_deadline_at ||
      ['confirmed', 'cancelled', 'failed'].includes(order.current_status)
    ) {
      return [];
    }
    const deadline = DateTime.fromISO(order.acceptance_deadline_at);
    if (now <= deadline) return [];
    const minutesOverdue = now.diff(deadline, 'minutes').minutes;
    return [
      {
        factor: `Acceptance deadline passed ${Math.round(minutesOverdue)} minutes ago`,
        score: Math.min(40, 20 + minutesOverdue),
      },
    ];
  }

  private pickupStateFactors(order: any): RiskFactor[] {
    if (order.pickup_state === 'at_risk') {
      return [{ factor: 'Pickup at risk', score: 25 }];
    }
    if (order.pickup_state === 'overdue') {
      return [{ factor: 'Pickup overdue', score: 40 }];
    }
    return [];
  }

  private deliveryWindowFactors(order: any, now: DateTime): RiskFactor[] {
    if (order.promised_fulfill_by) {
      const promiseEnd = DateTime.fromISO(order.promised_fulfill_by);
      if (promiseEnd.isValid && now > promiseEnd) {
        const minutesLate = now.diff(promiseEnd, 'minutes').minutes;
        return [
          {
            factor: `Past fulfillment promise by ${Math.round(minutesLate)} minutes`,
            score: Math.min(50, 30 + minutesLate * 0.5),
          },
        ];
      }
      if (order.fulfillment_timing === 'asap') return [];
    }
    const window = order.delivery_time_window as
      | { preferred_date?: string; time_slot_end?: string }
      | null
      | undefined;
    if (!window?.preferred_date || !window?.time_slot_end) return [];
    if (
      ['delivered', 'complete', 'cancelled'].includes(order.current_status)
    ) {
      return [];
    }
    const slotEnd = this.combineDateAndTime(
      window.preferred_date,
      window.time_slot_end
    );
    if (!slotEnd || now <= slotEnd) return [];
    const minutesLate = now.diff(slotEnd, 'minutes').minutes;
    return [
      {
        factor: `Past delivery window by ${Math.round(minutesLate)} minutes`,
        score: Math.min(50, 30 + minutesLate * 0.5),
      },
    ];
  }

  private agentPickupFactors(order: any, now: DateTime): RiskFactor[] {
    if (order.current_status !== 'assigned_to_agent' || !order.pickup_due_at) {
      return [];
    }
    const pickupDue = DateTime.fromISO(order.pickup_due_at);
    const minutesUntilDue = pickupDue.diff(now, 'minutes').minutes;
    if (minutesUntilDue < 0) {
      return [
        {
          factor: `Agent has not picked up (${Math.abs(Math.round(minutesUntilDue))} min overdue)`,
          score: Math.min(35, 15 + Math.abs(minutesUntilDue) * 0.5),
        },
      ];
    }
    if (minutesUntilDue < 10) {
      return [
        {
          factor: `Agent pickup due in ${Math.round(minutesUntilDue)} minutes`,
          score: 15,
        },
      ];
    }
    return [];
  }

  private estimatedDeliveryFactors(
    order: any,
    now: DateTime
  ): RiskFactor[] {
    if (
      !['out_for_delivery', 'in_transit'].includes(order.current_status) ||
      !order.estimated_delivery_time
    ) {
      return [];
    }
    const estimated = DateTime.fromISO(order.estimated_delivery_time);
    if (now <= estimated) return [];
    const minutesLate = now.diff(estimated, 'minutes').minutes;
    return [
      {
        factor: `Estimated delivery time passed ${Math.round(minutesLate)} minutes ago`,
        score: Math.min(30, 10 + minutesLate * 0.3),
      },
    ];
  }

  /**
   * Flag orders that remain in an in-progress status for too long
   * (e.g. ready_for_pickup for months with no agent / no pickup).
   */
  private stuckStatusFactors(order: any, now: DateTime): RiskFactor[] {
    if (!STUCK_STATUSES.has(order.current_status)) return [];
    const sinceIso = order.updated_at || order.created_at;
    if (!sinceIso) return [];
    const since = DateTime.fromISO(sinceIso);
    if (!since.isValid) return [];
    const hoursStuck = now.diff(since, 'hours').hours;
    if (hoursStuck < 4) return [];
    const days = Math.floor(hoursStuck / 24);
    const label =
      days >= 1
        ? `${days} day${days === 1 ? '' : 's'}`
        : `${Math.round(hoursStuck)} hours`;
    return [
      {
        factor: `Stuck in ${order.current_status} for ${label}`,
        score: Math.min(70, Math.round(15 + hoursStuck * 0.75)),
      },
    ];
  }

  private combineDateAndTime(
    date: string,
    time: string
  ): DateTime | null {
    const timePart = time.length === 5 ? `${time}:00` : time;
    const combined = DateTime.fromISO(`${date}T${timePart}`, { zone: 'utc' });
    return combined.isValid ? combined : null;
  }
}
