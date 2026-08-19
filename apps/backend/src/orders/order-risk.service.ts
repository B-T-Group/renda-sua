import { Injectable, Logger } from '@nestjs/common';
import { DateTime } from 'luxon';
import { Orders } from '../generated/graphql';

export interface OrderWithRisk extends Orders {
  risk_score: number;
  risk_factors: string[];
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

@Injectable()
export class OrderRiskService {
  private readonly logger = new Logger(OrderRiskService.name);

  calculateRiskScore(order: Orders): { score: number; factors: string[] } {
    const factors: RiskFactor[] = [];
    const now = DateTime.utc();

    if (!order.current_status) {
      return { score: 0, factors: [] };
    }

    if (order.current_status === 'pending' && order.created_at) {
      const minutesSinceCreated = now.diff(
        DateTime.fromISO(order.created_at),
        'minutes'
      ).minutes;
      
      if (minutesSinceCreated > 30) {
        factors.push({
          factor: `Not confirmed for ${Math.round(minutesSinceCreated)} minutes`,
          score: Math.min(30, minutesSinceCreated),
        });
      }
    }

    if (
      order.acceptance_deadline_at &&
      order.current_status !== 'confirmed' &&
      order.current_status !== 'cancelled' &&
      order.current_status !== 'failed'
    ) {
      const deadlineTime = DateTime.fromISO(order.acceptance_deadline_at);
      if (now > deadlineTime) {
        const minutesOverdue = now.diff(deadlineTime, 'minutes').minutes;
        factors.push({
          factor: `Acceptance deadline passed ${Math.round(minutesOverdue)} minutes ago`,
          score: Math.min(40, 20 + minutesOverdue),
        });
      }
    }

    if (order.pickup_state === 'at_risk') {
      factors.push({
        factor: 'Pickup at risk',
        score: 25,
      });
    }

    if (order.pickup_state === 'overdue') {
      factors.push({
        factor: 'Pickup overdue',
        score: 40,
      });
    }

    if (order.delivery_time_window) {
      const window = order.delivery_time_window as any;
      if (window.time_slot_end) {
        const slotEnd = DateTime.fromISO(window.time_slot_end);
        if (
          now > slotEnd &&
          order.current_status !== 'delivered' &&
          order.current_status !== 'complete' &&
          order.current_status !== 'cancelled'
        ) {
          const minutesLate = now.diff(slotEnd, 'minutes').minutes;
          factors.push({
            factor: `Past delivery window by ${Math.round(minutesLate)} minutes`,
            score: Math.min(50, 30 + minutesLate * 0.5),
          });
        }
      }
    }

    if (
      order.current_status === 'assigned_to_agent' &&
      order.pickup_due_at
    ) {
      const pickupDue = DateTime.fromISO(order.pickup_due_at);
      const minutesUntilDue = pickupDue.diff(now, 'minutes').minutes;
      
      if (minutesUntilDue < 0) {
        factors.push({
          factor: `Agent has not picked up (${Math.abs(Math.round(minutesUntilDue))} min overdue)`,
          score: Math.min(35, 15 + Math.abs(minutesUntilDue) * 0.5),
        });
      } else if (minutesUntilDue < 10) {
        factors.push({
          factor: `Agent pickup due in ${Math.round(minutesUntilDue)} minutes`,
          score: 15,
        });
      }
    }

    if (
      ['out_for_delivery', 'in_transit'].includes(order.current_status) &&
      order.estimated_delivery_time
    ) {
      const estimatedTime = DateTime.fromISO(order.estimated_delivery_time);
      if (now > estimatedTime) {
        const minutesLate = now.diff(estimatedTime, 'minutes').minutes;
        factors.push({
          factor: `Estimated delivery time passed ${Math.round(minutesLate)} minutes ago`,
          score: Math.min(30, 10 + minutesLate * 0.3),
        });
      }
    }

    const totalScore = factors.reduce((sum, f) => sum + f.score, 0);
    const factorDescriptions = factors.map((f) => f.factor);

    return {
      score: Math.min(100, Math.round(totalScore)),
      factors: factorDescriptions,
    };
  }

  getRiskLevel(score: number): RiskLevel {
    if (score >= 50) return RiskLevel.CRITICAL;
    if (score >= 30) return RiskLevel.HIGH;
    if (score >= 15) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }

  enrichOrderWithRisk(order: Orders): OrderWithRisk {
    const { score, factors } = this.calculateRiskScore(order);
    return {
      ...order,
      risk_score: score,
      risk_factors: factors,
    };
  }
}
