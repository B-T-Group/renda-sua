import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { CREDIT_WEIGHTS } from './credit-weights';
import type {
  AwardCreditInput,
  CreditContactChannel,
  CreditEventType,
  CreditOrderResult,
  OrderRiskIncidentLite,
  UserCreditRow,
} from './credit.types';

const CREDIT_FIELDS = `
  id user_id event_type weight order_id order_risk_incident_id
  referred_business_id referred_agent_id contact_channel order_result
  notes created_at created_by
`;

@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(private readonly hasura: HasuraSystemService) {}

  /** Idempotent insert. Returns null when already credited or on failure. */
  async award(input: AwardCreditInput): Promise<UserCreditRow | null> {
    try {
      return await this.insertCredit(input);
    } catch (error: any) {
      if (this.isUniqueViolation(error)) return null;
      this.logger.warn(
        `Credit award failed (${input.eventType}): ${error?.message}`
      );
      return null;
    }
  }

  async awardSafe(input: AwardCreditInput): Promise<UserCreditRow | null> {
    try {
      return await this.award(input);
    } catch (error: any) {
      this.logger.warn(
        `Credit awardSafe failed (${input.eventType}): ${error?.message}`
      );
      return null;
    }
  }

  async awardBusinessReferred(params: {
    referrerUserId: string;
    businessId: string;
    createdBy?: string | null;
  }): Promise<UserCreditRow | null> {
    return this.awardSafe({
      userId: params.referrerUserId,
      eventType: 'business_referred',
      referredBusinessId: params.businessId,
      createdBy: params.createdBy ?? params.referrerUserId,
    });
  }

  async awardAgentReferred(params: {
    referrerUserId: string;
    agentId: string;
    createdBy?: string | null;
  }): Promise<UserCreditRow | null> {
    return this.awardSafe({
      userId: params.referrerUserId,
      eventType: 'agent_referred',
      referredAgentId: params.agentId,
      createdBy: params.createdBy ?? params.referrerUserId,
    });
  }

  async awardMyFirstPurchase(params: {
    userId: string;
    orderId: string;
  }): Promise<UserCreditRow | null> {
    return this.awardSafe({
      userId: params.userId,
      eventType: 'my_first_purchase',
      orderId: params.orderId,
      createdBy: params.userId,
    });
  }

  async awardEscalationResolved(params: {
    userId: string;
    incidentId: string;
    orderId: string;
    contactChannel: CreditContactChannel;
    orderResult: CreditOrderResult;
    notes: string;
  }): Promise<UserCreditRow | null> {
    return this.awardSafe({
      userId: params.userId,
      eventType: 'escalation_resolved',
      orderRiskIncidentId: params.incidentId,
      orderId: params.orderId,
      contactChannel: params.contactChannel,
      orderResult: params.orderResult,
      notes: params.notes,
      createdBy: params.userId,
    });
  }

  async awardCancelledFeedback(params: {
    userId: string;
    orderId: string;
    notes: string;
  }): Promise<UserCreditRow | null> {
    return this.awardSafe({
      userId: params.userId,
      eventType: 'cancelled_feedback',
      orderId: params.orderId,
      notes: params.notes,
      createdBy: params.userId,
    });
  }

  async awardFirstOrderFeedback(params: {
    userId: string;
    orderId: string;
    notes: string;
  }): Promise<UserCreditRow | null> {
    return this.awardSafe({
      userId: params.userId,
      eventType: 'first_order_completed_feedback',
      orderId: params.orderId,
      notes: params.notes,
      createdBy: params.userId,
    });
  }

  async resolveReferrerUserId(params: {
    kind: 'agent' | 'business';
    agentId?: string;
    businessUserId?: string;
  }): Promise<string | null> {
    if (params.kind === 'business') return params.businessUserId ?? null;
    if (!params.agentId) return null;
    const res = await this.hasura.executeQuery<{
      agents_by_pk: { user_id: string } | null;
    }>(
      `query CreditReferrerAgent($id: uuid!) {
        agents_by_pk(id: $id) { user_id }
      }`,
      { id: params.agentId }
    );
    return res.agents_by_pk?.user_id ?? null;
  }

  getWeights(): Record<CreditEventType, number> {
    return { ...CREDIT_WEIGHTS };
  }

  async resolveIncidentForCredit(params: {
    incidentId: string;
    userId: string;
    note: string;
    contactChannel: CreditContactChannel;
    orderResult: CreditOrderResult;
  }): Promise<OrderRiskIncidentLite | null> {
    const incident = await this.markUnresolvedIncident(params);
    if (!incident) return this.getIncidentLite(params.incidentId);
    await this.recordRiskResolvedEvent(incident, params);
    return incident;
  }

  private resolutionSet(params: {
    userId: string;
    note: string;
    contactChannel: CreditContactChannel;
    orderResult: CreditOrderResult;
  }) {
    const now = new Date().toISOString();
    return {
      acknowledged_at: now,
      acknowledged_by: params.userId,
      acknowledged_note: params.note.trim(),
      resolved_at: now,
      resolution: 'acknowledged_resolved',
      resolved_by: params.userId,
      contact_channel: params.contactChannel,
      order_result: params.orderResult,
    };
  }

  private async markUnresolvedIncident(params: {
    incidentId: string;
    userId: string;
    note: string;
    contactChannel: CreditContactChannel;
    orderResult: CreditOrderResult;
  }): Promise<OrderRiskIncidentLite | null> {
    const res = await this.hasura.executeMutation<{
      update_order_risk_incidents: { returning: OrderRiskIncidentLite[] };
    }>(
      `mutation ResolveIncidentForCredit(
        $id: uuid!
        $set: order_risk_incidents_set_input!
      ) {
        update_order_risk_incidents(
          where: { id: { _eq: $id }, resolved_at: { _is_null: true } }
          _set: $set
        ) {
          returning { id order_id resolved_at }
        }
      }`,
      { id: params.incidentId, set: this.resolutionSet(params) }
    );
    return res.update_order_risk_incidents?.returning?.[0] ?? null;
  }

  private async getIncidentLite(
    incidentId: string
  ): Promise<OrderRiskIncidentLite | null> {
    const res = await this.hasura.executeQuery<{
      order_risk_incidents_by_pk: OrderRiskIncidentLite | null;
    }>(
      `query CreditIncidentLite($id: uuid!) {
        order_risk_incidents_by_pk(id: $id) {
          id order_id resolved_at
        }
      }`,
      { id: incidentId }
    );
    return res.order_risk_incidents_by_pk;
  }

  private async recordRiskResolvedEvent(
    incident: OrderRiskIncidentLite,
    params: {
      incidentId: string;
      userId: string;
      note: string;
      contactChannel: CreditContactChannel;
      orderResult: CreditOrderResult;
    }
  ): Promise<void> {
    try {
      await this.hasura.executeMutation(
        `mutation InsertCreditRiskResolvedEvent(
          $orderId: uuid!
          $eventType: String!
          $actorType: String!
          $actorId: uuid
          $payload: jsonb!
        ) {
          insert_order_events_one(object: {
            order_id: $orderId
            event_type: $eventType
            actor_type: $actorType
            actor_id: $actorId
            payload: $payload
          }) { id }
        }`,
        {
          orderId: incident.order_id,
          eventType: 'risk_incident_resolved',
          actorType: 'support',
          actorId: params.userId,
          payload: {
            incidentId: params.incidentId,
            note: params.note.trim(),
            contact_channel: params.contactChannel,
            order_result: params.orderResult,
          },
        }
      );
    } catch (error: any) {
      this.logger.warn(
        `Failed to record risk_incident_resolved for ${incident.order_id}: ${error?.message}`
      );
    }
  }

  private async insertCredit(
    input: AwardCreditInput
  ): Promise<UserCreditRow | null> {
    const weight = CREDIT_WEIGHTS[input.eventType];
    const object = {
      user_id: input.userId,
      event_type: input.eventType,
      weight,
      order_id: input.orderId ?? null,
      order_risk_incident_id: input.orderRiskIncidentId ?? null,
      referred_business_id: input.referredBusinessId ?? null,
      referred_agent_id: input.referredAgentId ?? null,
      contact_channel: input.contactChannel ?? null,
      order_result: input.orderResult ?? null,
      notes: input.notes?.trim() || null,
      created_by: input.createdBy ?? null,
    };
    const res = await this.hasura.executeMutation<{
      insert_user_credits_one: UserCreditRow | null;
    }>(
      `mutation InsertUserCredit($object: user_credits_insert_input!) {
        insert_user_credits_one(object: $object) { ${CREDIT_FIELDS} }
      }`,
      { object }
    );
    return res.insert_user_credits_one;
  }

  private isUniqueViolation(error: any): boolean {
    const message = String(error?.message ?? error ?? '');
    return (
      message.includes('Uniqueness violation') ||
      message.includes('unique constraint') ||
      message.includes('duplicate key')
    );
  }
}
