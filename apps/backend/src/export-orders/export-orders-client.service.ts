import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import {
  ClientProformaActionDto,
  ConfirmDeliveryDto,
  SelectBalanceOptionDto,
} from './dto/admin-export-order.dto';
import { EXPORT_EVENTS } from './export-order.statuses';
import { ExportOrdersPdfService } from './export-orders-pdf.service';
import { ExportOrdersTransitionService } from './export-orders-transition.service';
import {
  ACTIVE_BANK_ACCOUNT,
  INSERT_INVOICE,
  UPDATE_INVOICE,
} from './export-orders.queries';
import type { BankAccountSnapshot, ExportOrderRow } from './export-orders.types';
import { ExportOrdersCommissionService } from './export-orders-commission.service';

@Injectable()
export class ExportOrdersClientService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly hasuraUser: HasuraUserService,
    private readonly transitions: ExportOrdersTransitionService,
    private readonly pdf: ExportOrdersPdfService,
    private readonly commissions: ExportOrdersCommissionService
  ) {}

  async handleProforma(orderId: string, dto: ClientProformaActionDto) {
    const user = await this.hasuraUser.getUser();
    const order = await this.transitions.getOrder(orderId);
    this.assertOwner(order, user.id);
    if (order.status !== 'PROFORMA_ISSUED') {
      throw new HttpException('No proforma to act on', HttpStatus.BAD_REQUEST);
    }
    if (dto.action === 'request_adjustment') {
      return this.transitions.transition({
        orderId,
        to: 'PROFORMA_ISSUED',
        eventName: EXPORT_EVENTS.proformaIssued,
        actorUserId: user.id,
        actorRole: 'client',
        payload: { adjustment: true, notes: dto.notes },
      });
    }
    const proforma = order.invoices?.find(
      (i) => i.kind === 'PROFORMA' && !i.client_approved_at
    );
    if (!proforma) {
      throw new HttpException('Proforma not found', HttpStatus.BAD_REQUEST);
    }
    if (
      proforma.valid_until &&
      new Date(proforma.valid_until).getTime() < Date.now()
    ) {
      throw new HttpException('Proforma expired', HttpStatus.BAD_REQUEST);
    }
    const approvedAt = new Date().toISOString();
    await this.hasura.executeMutation(UPDATE_INVOICE, {
      id: proforma.id,
      set: {
        client_approved_at: approvedAt,
        client_approved_by: user.id,
        locked: true,
      },
    });
    await this.transitions.transition({
      orderId,
      to: 'INVOICED',
      eventName: EXPORT_EVENTS.proformaValidated,
      actorUserId: user.id,
      actorRole: 'client',
    });
    return this.issueInvoiceAndRequireDeposit(orderId, user.id, approvedAt);
  }

  async selectBalanceOption(orderId: string, dto: SelectBalanceOptionDto) {
    const user = await this.hasuraUser.getUser();
    const order = await this.transitions.getOrder(orderId);
    this.assertOwner(order, user.id);
    if (order.status !== 'BALANCE_REQUIRED') {
      throw new HttpException(
        'Balance option not available',
        HttpStatus.BAD_REQUEST
      );
    }
    if (dto.option === 'FULL') {
      return this.transitions.transition({
        orderId,
        to: 'PAID_IN_FULL',
        eventName: EXPORT_EVENTS.balanceOptionSelected,
        actorUserId: user.id,
        actorRole: 'client',
        extraSet: { balance_option: 'FULL' },
        payload: { option: dto.option },
      });
    }
    const days = dto.option === 'FINANCED_30' ? 30 : 60;
    await this.commissions.ensureFinancing(order, days, user.id);
    return this.transitions.transition({
      orderId,
      to: days === 30 ? 'FINANCED_30' : 'FINANCED_60',
      eventName: EXPORT_EVENTS.financingApproved,
      actorUserId: user.id,
      actorRole: 'client',
      extraSet: { balance_option: dto.option },
      payload: { option: dto.option },
    });
  }

  async confirmDelivery(orderId: string, dto: ConfirmDeliveryDto) {
    const user = await this.hasuraUser.getUser();
    const order = await this.transitions.getOrder(orderId);
    this.assertOwner(order, user.id);
    if (order.status !== 'SHIPPED') {
      throw new HttpException('Not shipped yet', HttpStatus.BAD_REQUEST);
    }
    const delivered = await this.transitions.transition({
      orderId,
      to: 'DELIVERED',
      eventName: EXPORT_EVENTS.delivered,
      actorUserId: user.id,
      actorRole: 'client',
      extraSet: {
        has_open_dispute: Boolean(dto.openDispute),
        admin_notes: dto.reserves?.trim() || order.admin_notes,
      },
    });
    await this.commissions.markPayableOnDelivery(orderId);
    await this.commissions.awardPaymentCredit(delivered);
    if (!delivered.has_open_dispute) {
      return this.tryClose(orderId, user.id);
    }
    return delivered;
  }

  private async issueInvoiceAndRequireDeposit(
    orderId: string,
    actorUserId: string,
    approvedAt: string
  ) {
    const order = await this.transitions.getOrder(orderId);
    const bank = await this.activeBank();
    const proforma = order.invoices?.find((i) => i.kind === 'PROFORMA');
    if (!proforma) {
      throw new HttpException('Proforma missing', HttpStatus.BAD_REQUEST);
    }
    const doc = await this.pdf.issueInvoice(
      order,
      actorUserId,
      bank,
      [],
      {
        subtotal: Number(proforma.subtotal),
        feesTotal: Number(proforma.fees_total),
        taxTotal: Number(proforma.tax_total),
        grandTotal: Number(proforma.grand_total),
        depositAmount: Number(proforma.deposit_amount),
        balanceAmount: Number(proforma.balance_amount),
        approvedAt,
      }
    );
    await this.hasura.executeMutation(INSERT_INVOICE, {
      object: {
        export_order_id: orderId,
        kind: 'INVOICE',
        document_id: doc.id,
        version_number: 1,
        subtotal: proforma.subtotal,
        fees_total: proforma.fees_total,
        tax_total: proforma.tax_total,
        grand_total: proforma.grand_total,
        deposit_rate: proforma.deposit_rate,
        deposit_amount: proforma.deposit_amount,
        balance_amount: proforma.balance_amount,
        bank_account_snapshot: bank,
        locked: true,
        client_approved_at: approvedAt,
      },
    });
    await this.transitions.transition({
      orderId,
      to: 'DEPOSIT_REQUIRED',
      eventName: EXPORT_EVENTS.invoiceIssued,
      actorUserId,
      actorRole: 'system',
      extraSet: {
        deposit_due_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
      },
    });
    return this.transitions.getOrder(orderId);
  }

  private async tryClose(orderId: string, actorUserId: string) {
    const order = await this.transitions.getOrder(orderId);
    const paid =
      order.status === 'DELIVERED' ||
      order.status === 'CLOSED' ||
      order.status === 'REVIEWED';
    if (!paid || order.has_open_dispute) return order;
    return this.transitions.transition({
      orderId,
      to: 'CLOSED',
      eventName: EXPORT_EVENTS.closed,
      actorUserId,
      actorRole: 'client',
      extraSet: { closed_at: new Date().toISOString() },
    });
  }

  private assertOwner(order: ExportOrderRow, userId: string) {
    if (order.client_user_id !== userId) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
  }

  private async activeBank(): Promise<BankAccountSnapshot | null> {
    const res = await this.hasura.executeQuery<{
      export_bank_accounts: BankAccountSnapshot[];
    }>(ACTIVE_BANK_ACCOUNT);
    return res.export_bank_accounts?.[0] ?? null;
  }
}
