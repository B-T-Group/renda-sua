import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import {
  AdminReviewDto,
  AttachManufacturerQuoteDto,
  IssueProformaDto,
} from './dto/admin-export-order.dto';
import { EXPORT_EVENTS } from './export-order.statuses';
import { ExportOrdersPdfService } from './export-orders-pdf.service';
import { ExportOrdersTransitionService } from './export-orders-transition.service';
import {
  ACTIVE_BANK_ACCOUNT,
  DELETE_FEES,
  INSERT_FEES,
  INSERT_INVOICE,
  INSERT_MFR_QUOTE,
  INSERT_REVIEW,
  INSERT_REVENUE,
  INSERT_VERSION,
  UPDATE_LINE,
} from './export-orders.queries';
import type { BankAccountSnapshot, ExportOrderRow } from './export-orders.types';
import { ExportOrdersService } from './export-orders.service';

@Injectable()
export class ExportOrdersAdminService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly hasuraUser: HasuraUserService,
    private readonly transitions: ExportOrdersTransitionService,
    private readonly pdf: ExportOrdersPdfService,
    private readonly exportOrders: ExportOrdersService
  ) {}

  async list(page?: number, limit?: number, status?: string) {
    return this.exportOrders.listForActor({
      role: 'admin',
      page,
      limit,
      status,
    });
  }

  async review(orderId: string, dto: AdminReviewDto) {
    const user = await this.hasuraUser.getUser();
    await this.ensureInReview(orderId, user.id);
    await this.hasura.executeMutation(INSERT_REVIEW, {
      object: {
        export_order_id: orderId,
        decision: dto.decision,
        notes: dto.notes?.trim() || null,
        author_user_id: user.id,
      },
    });
    if (dto.decision === 'APPROVE') {
      return this.transitions.transition({
        orderId,
        to: 'MFR_QUOTE',
        eventName: EXPORT_EVENTS.approved,
        actorUserId: user.id,
        actorRole: 'admin',
        payload: { notes: dto.notes },
      });
    }
    if (dto.decision === 'CHANGES_REQUESTED') {
      if (!dto.notes?.trim()) {
        throw new HttpException('Notes required', HttpStatus.BAD_REQUEST);
      }
      return this.transitions.transition({
        orderId,
        to: 'CHANGES_REQUESTED',
        eventName: EXPORT_EVENTS.changesRequested,
        actorUserId: user.id,
        actorRole: 'admin',
        payload: { notes: dto.notes },
      });
    }
    if (!dto.notes?.trim()) {
      throw new HttpException('Notes required', HttpStatus.BAD_REQUEST);
    }
    return this.transitions.transition({
      orderId,
      to: 'REJECTED',
      eventName: EXPORT_EVENTS.rejected,
      actorUserId: user.id,
      actorRole: 'admin',
      payload: { notes: dto.notes },
    });
  }

  async attachManufacturerQuote(
    orderId: string,
    dto: AttachManufacturerQuoteDto
  ) {
    const user = await this.hasuraUser.getUser();
    const order = await this.transitions.getOrder(orderId);
    if (order.status !== 'MFR_QUOTE') {
      throw new HttpException(
        'Order must be in MFR_QUOTE',
        HttpStatus.BAD_REQUEST
      );
    }
    await this.hasura.executeMutation(INSERT_MFR_QUOTE, {
      object: {
        export_order_id: orderId,
        attachment_upload_id: dto.attachmentUploadId ?? null,
        lead_time_days: dto.leadTimeDays ?? null,
        notes: dto.notes?.trim() || null,
        confirmed_by_user_id: user.id,
        confirmed_at: new Date().toISOString(),
      },
    });
    return this.transitions.getOrder(orderId);
  }

  async issueProforma(orderId: string, dto: IssueProformaDto) {
    const user = await this.hasuraUser.getUser();
    const order = await this.transitions.getOrder(orderId);
    if (order.status !== 'MFR_QUOTE' && order.status !== 'PROFORMA_ISSUED') {
      throw new HttpException(
        'Proforma requires MFR_QUOTE or PROFORMA_ISSUED',
        HttpStatus.BAD_REQUEST
      );
    }
    const priced = await this.applyLinePrices(order, dto);
    const fees = dto.fees ?? [];
    await this.replaceFees(orderId, fees);
    const feesTotal = fees.reduce((s, f) => s + Number(f.amount), 0);
    const depositRate = dto.depositRate ?? 0.4;
    const grandTotal = priced.subtotal + feesTotal;
    const depositAmount = round2(grandTotal * depositRate);
    const balanceAmount = round2(grandTotal - depositAmount);
    const validityDays = dto.validityDays ?? 7;
    const validUntil = new Date(
      Date.now() + validityDays * 24 * 60 * 60 * 1000
    ).toISOString();
    const bank = await this.activeBank();
    const version =
      order.status === 'PROFORMA_ISSUED'
        ? (order.invoices?.filter((i) => i.kind === 'PROFORMA').length ?? 0) + 1
        : 1;
    const refreshed = await this.transitions.getOrder(orderId);
    const doc = await this.pdf.issueProforma(
      refreshed,
      user.id,
      bank,
      fees.map((f) => ({
        label: f.label,
        fee_type: f.feeType,
        amount: Number(f.amount),
      })),
      {
        subtotal: priced.subtotal,
        feesTotal,
        taxTotal: 0,
        grandTotal,
        depositAmount,
        balanceAmount,
        depositRate,
        validityDays,
        validUntil,
        version,
      }
    );
    await this.hasura.executeMutation(INSERT_INVOICE, {
      object: {
        export_order_id: orderId,
        kind: 'PROFORMA',
        document_id: doc.id,
        version_number: version,
        subtotal: priced.subtotal,
        fees_total: feesTotal,
        tax_total: 0,
        grand_total: grandTotal,
        deposit_rate: depositRate,
        deposit_amount: depositAmount,
        balance_amount: balanceAmount,
        validity_days: validityDays,
        valid_until: validUntil,
        bank_account_snapshot: bank,
        locked: false,
      },
    });
    await this.hasura.executeMutation(INSERT_VERSION, {
      object: {
        export_order_id: orderId,
        version_kind: 'PROFORMA',
        version_number: version,
        snapshot: { lines: refreshed.lines, fees, totals: { grandTotal } },
        created_by: user.id,
      },
    });
    await this.upsertRevenue(orderId, priced, feesTotal, grandTotal);
    return this.transitions.transition({
      orderId,
      to: 'PROFORMA_ISSUED',
      eventName: EXPORT_EVENTS.proformaIssued,
      actorUserId: user.id,
      actorRole: 'admin',
      extraSet: {
        deposit_rate: depositRate,
        credit_rate_full: dto.creditRateFull ?? 0.05,
        credit_rate_30: dto.creditRate30 ?? 0.025,
        credit_rate_60: dto.creditRate60 ?? 0,
        client_subtotal: priced.subtotal,
        fees_total: feesTotal,
        tax_total: 0,
        grand_total: grandTotal,
        deposit_amount: depositAmount,
        balance_amount: balanceAmount,
        manufacturer_cost_total: priced.mfrCost,
        proforma_expires_at: validUntil,
      },
    });
  }

  private async ensureInReview(orderId: string, actorUserId: string) {
    const order = await this.transitions.getOrder(orderId);
    if (order.status === 'SUBMITTED') {
      return this.exportOrders.startReview(orderId, actorUserId);
    }
    if (order.status !== 'IN_REVIEW') {
      throw new HttpException(
        'Order must be SUBMITTED or IN_REVIEW',
        HttpStatus.BAD_REQUEST
      );
    }
    return order;
  }

  private async applyLinePrices(order: ExportOrderRow, dto: IssueProformaDto) {
    let subtotal = 0;
    let mfrCost = 0;
    for (const line of dto.lines) {
      const existing = order.lines?.find((l) => l.id === line.lineId);
      if (!existing) {
        throw new HttpException(`Unknown line ${line.lineId}`, HttpStatus.BAD_REQUEST);
      }
      const lineTotal = round2(Number(existing.quantity) * Number(line.unitPrice));
      subtotal += lineTotal;
      mfrCost += round2(
        Number(existing.quantity) * Number(line.manufacturerUnitCost ?? 0)
      );
      await this.hasura.executeMutation(UPDATE_LINE, {
        id: line.lineId,
        set: {
          unit_price: line.unitPrice,
          manufacturer_unit_cost: line.manufacturerUnitCost ?? null,
          line_total: lineTotal,
          updated_at: new Date().toISOString(),
        },
      });
    }
    return { subtotal: round2(subtotal), mfrCost: round2(mfrCost) };
  }

  private async replaceFees(
    orderId: string,
    fees: IssueProformaDto['fees']
  ) {
    await this.hasura.executeMutation(DELETE_FEES, { orderId });
    if (!fees?.length) return;
    await this.hasura.executeMutation(INSERT_FEES, {
      objects: fees.map((f) => ({
        export_order_id: orderId,
        fee_type: f.feeType,
        label: f.label,
        description: f.description ?? null,
        intervenant: f.intervenant ?? null,
        amount: f.amount,
      })),
    });
  }

  private async activeBank(): Promise<BankAccountSnapshot | null> {
    const res = await this.hasura.executeQuery<{
      export_bank_accounts: BankAccountSnapshot[];
    }>(ACTIVE_BANK_ACCOUNT);
    return res.export_bank_accounts?.[0] ?? null;
  }

  private async upsertRevenue(
    orderId: string,
    priced: { subtotal: number; mfrCost: number },
    feesTotal: number,
    grandTotal: number
  ) {
    await this.hasura.executeMutation(INSERT_REVENUE, {
      object: {
        export_order_id: orderId,
        manufacturer_cost: priced.mfrCost,
        client_price: priced.subtotal,
        fees_passthrough: feesTotal,
        rendasua_revenue: round2(priced.subtotal - priced.mfrCost),
        updated_at: new Date().toISOString(),
      },
    });
    void grandTotal;
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
