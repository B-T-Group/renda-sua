import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { ExportDocNumberService } from './export-doc-number.service';
import {
  INSERT_COMMISSION,
  INSERT_CREDIT_LEDGER,
  INSERT_CREDIT_NOTE,
  LIST_FINANCING_DUE,
  UPSERT_FINANCING,
} from './export-orders.queries';
import type { ExportOrderRow } from './export-orders.types';
import { ExportOrdersTransitionService } from './export-orders-transition.service';

const DEFAULT_AGENT_RATE = 0.05;
const CREDIT_EXPIRY_DAYS = 365;

@Injectable()
export class ExportOrdersCommissionService {
  private readonly logger = new Logger(ExportOrdersCommissionService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly docNumbers: ExportDocNumberService,
    private readonly transitions: ExportOrdersTransitionService
  ) {}

  async accrueOnPayment(
    orderId: string,
    paymentId: string,
    paymentAmount: number
  ) {
    const order = await this.transitions.getOrder(orderId);
    if (!order.agent_user_id) return;
    const rate = await this.agentRate(order.agent_user_id);
    const revenue = await this.orderRevenue(orderId);
    const grand = Number(order.grand_total || 0) || 1;
    const share = (revenue * paymentAmount) / grand;
    const amount = round2(share * rate);
    if (amount <= 0) return;
    await this.hasura.executeMutation(INSERT_COMMISSION, {
      object: {
        export_order_id: orderId,
        agent_user_id: order.agent_user_id,
        payment_id: paymentId,
        base_amount: round2(share),
        rate,
        amount,
        status: 'accrued',
      },
    });
  }

  async markPayableOnDelivery(orderId: string) {
    await this.hasura.executeMutation(
      `mutation MarkPayable($orderId: uuid!, $updatedAt: timestamptz!) {
        update_export_commissions(
          where: {
            export_order_id: { _eq: $orderId }
            status: { _eq: "accrued" }
          }
          _set: { status: "payable", updated_at: $updatedAt }
        ) { affected_rows }
      }`,
      { orderId, updatedAt: new Date().toISOString() }
    );
  }

  async awardPaymentCredit(order: ExportOrderRow) {
    const option = order.balance_option;
    let rate = 0;
    if (option === 'FULL') rate = Number(order.credit_rate_full || 0.05);
    if (option === 'FINANCED_30') rate = Number(order.credit_rate_30 || 0.025);
    if (rate <= 0) return;
    const base = Number(order.balance_amount || 0);
    const amount = round2(base * rate);
    if (amount <= 0) return;
    const docNumber = await this.docNumbers.next('CR');
    const expiresAt = new Date(
      Date.now() + CREDIT_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const note = await this.hasura.executeMutation<{
      insert_export_credit_notes_one: { id: string };
    }>(INSERT_CREDIT_NOTE, {
      object: {
        export_order_id: order.id,
        client_user_id: order.client_user_id,
        document_number: docNumber,
        amount,
        reason: `Credit ${rate * 100}% for ${option}`,
        expires_at: expiresAt,
      },
    });
    await this.hasura.executeMutation(INSERT_CREDIT_LEDGER, {
      object: {
        client_user_id: order.client_user_id,
        export_order_id: order.id,
        credit_note_id: note.insert_export_credit_notes_one.id,
        entry_type: 'accrued',
        amount,
        expires_at: expiresAt,
      },
    });
  }

  async ensureFinancing(
    order: ExportOrderRow,
    days: number,
    actorUserId: string
  ) {
    const due = new Date();
    due.setDate(due.getDate() + days);
    await this.hasura.executeMutation(UPSERT_FINANCING, {
      object: {
        export_order_id: order.id,
        option_days: days,
        approved: true,
        approved_by: actorUserId,
        approved_at: new Date().toISOString(),
        due_date: due.toISOString().slice(0, 10),
        principal: order.balance_amount || 0,
        status: 'active',
        updated_at: new Date().toISOString(),
      },
    });
  }

  async markFinancingPaid(orderId: string) {
    await this.hasura.executeMutation(
      `mutation MarkFinancingPaid($orderId: uuid!, $updatedAt: timestamptz!) {
        update_export_financing(
          where: { export_order_id: { _eq: $orderId } }
          _set: { status: "paid", updated_at: $updatedAt }
        ) { affected_rows }
      }`,
      { orderId, updatedAt: new Date().toISOString() }
    );
  }

  async sendFinancingReminders() {
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 7);
    const to = new Date(today);
    to.setDate(to.getDate() + 7);
    const res = await this.hasura.executeQuery<{
      export_financing: Array<{
        id: string;
        export_order_id: string;
        due_date: string;
        status: string;
        export_order: {
          id: string;
          client_user_id: string;
          agent_user_id: string | null;
          bc_number: string | null;
        } | null;
      }>;
    }>(LIST_FINANCING_DUE, {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    });
    for (const row of res.export_financing ?? []) {
      const due = new Date(row.due_date);
      const diffDays = Math.round(
        (due.getTime() - today.setHours(0, 0, 0, 0)) / (24 * 60 * 60 * 1000)
      );
      if (![7, 0, -7].includes(diffDays)) continue;
      try {
        if (diffDays === -7) {
          await this.hasura.executeMutation(
            `mutation MarkOverdue($id: uuid!, $updatedAt: timestamptz!) {
              update_export_financing_by_pk(
                pk_columns: { id: $id }
                _set: { status: "overdue", updated_at: $updatedAt }
              ) { id }
            }`,
            { id: row.id, updatedAt: new Date().toISOString() }
          );
        }
        this.logger.log(
          `financing reminder ${row.export_order?.bc_number} day=${diffDays}`
        );
      } catch (error: any) {
        this.logger.warn(`financing reminder: ${error?.message}`);
      }
    }
  }

  private async agentRate(_agentUserId: string) {
    return DEFAULT_AGENT_RATE;
  }

  private async orderRevenue(orderId: string) {
    const res = await this.hasura.executeQuery<{
      export_order_revenue: Array<{ rendasua_revenue: number }>;
    }>(
      `query Rev($id: uuid!) {
        export_order_revenue(where: { export_order_id: { _eq: $id } }, limit: 1) {
          rendasua_revenue
        }
      }`,
      { id: orderId }
    );
    return Number(res.export_order_revenue?.[0]?.rendasua_revenue || 0);
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
