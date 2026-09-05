import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  DEFAULT_ORDER_RISK_CONFIG,
  isOrderRiskSeverity,
  type OrderRiskConfig,
} from './order-risk.types';

interface ConfigRow {
  config_key: string;
  number_value?: number | null;
  string_value?: string | null;
}

const CONFIG_KEYS = [
  'order_risk_alert_enabled',
  'order_risk_alert_min_severity',
  'order_risk_alert_repeat_minutes',
  'order_risk_pending_acceptance_grace_minutes',
  'order_risk_pending_fallback_minutes',
  'order_risk_scheduled_activation_grace_minutes',
  'order_risk_prep_overdue_minutes',
  'order_risk_ready_unassigned_minutes',
  'order_risk_pickup_uncollected_minutes',
  'order_risk_pickup_overdue_grace_minutes',
  'order_risk_delivery_delayed_minutes',
  'order_risk_critical_after_minutes',
];

const CONFIG_QUERY = `
  query OrderRiskConfig($keys: [String!]!) {
    application_configurations(
      where: { config_key: { _in: $keys }, status: { _eq: "active" } }
    ) {
      config_key
      number_value
      string_value
    }
  }
`;

@Injectable()
export class OrderRiskConfigService {
  private readonly logger = new Logger(OrderRiskConfigService.name);

  constructor(private readonly hasura: HasuraSystemService) {}

  async load(): Promise<OrderRiskConfig> {
    try {
      const res = await this.hasura.executeQuery<{
        application_configurations: ConfigRow[];
      }>(CONFIG_QUERY, { keys: CONFIG_KEYS });
      return this.map(res.application_configurations ?? []);
    } catch (error: any) {
      this.logger.warn(
        `Falling back to default order risk config: ${error?.message}`
      );
      return DEFAULT_ORDER_RISK_CONFIG;
    }
  }

  private map(rows: ConfigRow[]): OrderRiskConfig {
    const numbers = this.numberMap(rows);
    const strings = this.stringMap(rows);
    const d = DEFAULT_ORDER_RISK_CONFIG;
    const minSeverity = strings['order_risk_alert_min_severity'];
    return {
      alertsEnabled:
        (numbers['order_risk_alert_enabled'] ?? (d.alertsEnabled ? 1 : 0)) === 1,
      minSeverity: isOrderRiskSeverity(minSeverity) ? minSeverity : d.minSeverity,
      alertRepeatMinutes:
        numbers['order_risk_alert_repeat_minutes'] ?? d.alertRepeatMinutes,
      pendingAcceptanceGraceMinutes:
        numbers['order_risk_pending_acceptance_grace_minutes'] ??
        d.pendingAcceptanceGraceMinutes,
      pendingFallbackMinutes:
        numbers['order_risk_pending_fallback_minutes'] ?? d.pendingFallbackMinutes,
      scheduledActivationGraceMinutes:
        numbers['order_risk_scheduled_activation_grace_minutes'] ??
        d.scheduledActivationGraceMinutes,
      prepOverdueMinutes:
        numbers['order_risk_prep_overdue_minutes'] ?? d.prepOverdueMinutes,
      readyUnassignedMinutes:
        numbers['order_risk_ready_unassigned_minutes'] ?? d.readyUnassignedMinutes,
      pickupUncollectedMinutes:
        numbers['order_risk_pickup_uncollected_minutes'] ??
        d.pickupUncollectedMinutes,
      pickupOverdueGraceMinutes:
        numbers['order_risk_pickup_overdue_grace_minutes'] ??
        d.pickupOverdueGraceMinutes,
      deliveryDelayedMinutes:
        numbers['order_risk_delivery_delayed_minutes'] ?? d.deliveryDelayedMinutes,
      criticalAfterMinutes:
        numbers['order_risk_critical_after_minutes'] ?? d.criticalAfterMinutes,
    };
  }

  private numberMap(rows: ConfigRow[]): Record<string, number> {
    return rows.reduce((acc: Record<string, number>, row) => {
      if (row.number_value != null) acc[row.config_key] = Number(row.number_value);
      return acc;
    }, {});
  }

  private stringMap(rows: ConfigRow[]): Record<string, string> {
    return rows.reduce((acc: Record<string, string>, row) => {
      const value = row.string_value?.trim();
      if (value) acc[row.config_key] = value;
      return acc;
    }, {});
  }
}
