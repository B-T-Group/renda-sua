import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import {
  RecordExportPaymentDto,
  RecordSupplierPaymentDto,
  UpsertExportBankAccountDto,
} from './dto/admin-export-order.dto';
import { EXPORT_EVENTS } from './export-order.statuses';
import { ExportOrdersCommissionService } from './export-orders-commission.service';
import { ExportOrdersPdfService } from './export-orders-pdf.service';
import { ExportOrdersTransitionService } from './export-orders-transition.service';
import {
  DEACTIVATE_BANK_ACCOUNTS,
  INSERT_BANK_ACCOUNT,
  INSERT_PAYMENT,
  INSERT_SUPPLIER_PAYMENT,
  UPDATE_PAYMENT,
} from './export-orders.queries';

@Injectable()
export class ExportOrdersFinanceService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly hasuraUser: HasuraUserService,
    private readonly transitions: ExportOrdersTransitionService,
    private readonly pdf: ExportOrdersPdfService,
    private readonly commissions: ExportOrdersCommissionService
  ) {}

  async upsertBankAccount(dto: UpsertExportBankAccountDto) {
    await this.hasura.executeMutation(DEACTIVATE_BANK_ACCOUNTS, {
      validTo: new Date().toISOString(),
    });
    const res = await this.hasura.executeMutation<{
      insert_export_bank_accounts_one: { id: string };
    }>(INSERT_BANK_ACCOUNT, {
      object: {
        institution: dto.institution,
        transit: dto.transit ?? null,
        account_number: dto.accountNumber,
        swift: dto.swift ?? null,
        beneficiary: dto.beneficiary,
        currency: dto.currency || 'CAD',
        is_active: true,
        valid_from: new Date().toISOString(),
        valid_to: null,
      },
    });
    return res.insert_export_bank_accounts_one;
  }

  async recordClientPayment(orderId: string, dto: RecordExportPaymentDto) {
    const user = await this.hasuraUser.getUser();
    const order = await this.transitions.getOrder(orderId);
    const allocation = dto.allocation || 'deposit';
    if (allocation === 'deposit' && order.status !== 'DEPOSIT_REQUIRED') {
      throw new HttpException(
        'Deposit payment only when DEPOSIT_REQUIRED',
        HttpStatus.BAD_REQUEST
      );
    }
    const paymentRes = await this.hasura.executeMutation<{
      insert_export_payments_one: { id: string; amount: number; allocation: string };
    }>(INSERT_PAYMENT, {
      object: {
        export_order_id: orderId,
        amount: dto.amount,
        currency: order.currency || 'CAD',
        method: dto.method || 'wire',
        reference: dto.reference ?? null,
        value_date: dto.valueDate || new Date().toISOString().slice(0, 10),
        allocation,
        recorded_by: user.id,
      },
    });
    const payment = paymentRes.insert_export_payments_one;
    const paidTotal = (order.payments ?? [])
      .filter((p) => !p.voided_at)
      .reduce((s, p) => s + Number(p.amount), 0) + Number(dto.amount);
    const remaining = Math.max(0, Number(order.grand_total ?? 0) - paidTotal);
    const receipt = await this.pdf.issueReceipt(order, user.id, {
      amount: Number(dto.amount),
      currency: order.currency || 'CAD',
      allocation,
      method: dto.method || 'wire',
      reference: dto.reference,
      valueDate: dto.valueDate || new Date().toISOString().slice(0, 10),
      remaining,
    });
    await this.hasura.executeMutation(UPDATE_PAYMENT, {
      id: payment.id,
      set: { receipt_document_id: receipt.id },
    });
    await this.commissions.accrueOnPayment(orderId, payment.id, Number(dto.amount));
    if (allocation === 'deposit') {
      return this.transitions.transition({
        orderId,
        to: 'DEPOSIT_RECEIVED',
        eventName: EXPORT_EVENTS.paymentRecorded,
        actorUserId: user.id,
        actorRole: 'finance',
        payload: { paymentId: payment.id },
      });
    }
    if (allocation === 'balance' && order.status === 'BALANCE_REQUIRED') {
      return this.transitions.transition({
        orderId,
        to: 'PAID_IN_FULL',
        eventName: EXPORT_EVENTS.paymentRecorded,
        actorUserId: user.id,
        actorRole: 'finance',
        extraSet: { balance_option: 'FULL' },
      });
    }
    if (allocation === 'financing_repayment') {
      await this.commissions.markFinancingPaid(orderId);
    }
    return this.transitions.getOrder(orderId);
  }

  async recordSupplierPayment(orderId: string, dto: RecordSupplierPaymentDto) {
    const user = await this.hasuraUser.getUser();
    await this.transitions.getOrder(orderId);
    await this.hasura.executeMutation(INSERT_SUPPLIER_PAYMENT, {
      object: {
        export_order_id: orderId,
        kind: dto.kind,
        amount: dto.amount,
        reference: dto.reference ?? null,
        proof_upload_id: dto.proofUploadId ?? null,
        recorded_by: user.id,
      },
    });
    const event =
      dto.kind === 'deposit'
        ? EXPORT_EVENTS.supplierDepositSent
        : EXPORT_EVENTS.supplierBalanceSent;
    if (dto.kind === 'deposit') {
      return this.transitions.transition({
        orderId,
        to: 'IN_PRODUCTION',
        eventName: event,
        actorUserId: user.id,
        actorRole: 'finance',
      });
    }
    return this.transitions.getOrder(orderId);
  }
}
