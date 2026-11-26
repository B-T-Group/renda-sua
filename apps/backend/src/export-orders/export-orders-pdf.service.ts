import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as Mustache from 'mustache';
import * as path from 'path';
import { PdfService } from '../pdf/pdf.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { ExportDocNumberService } from './export-doc-number.service';
import { INSERT_DOCUMENT } from './export-orders.queries';
import type { BankAccountSnapshot, ExportOrderRow } from './export-orders.types';

@Injectable()
export class ExportOrdersPdfService {
  private readonly logger = new Logger(ExportOrdersPdfService.name);

  constructor(
    private readonly pdf: PdfService,
    private readonly hasura: HasuraSystemService,
    private readonly docNumbers: ExportDocNumberService
  ) {}

  async issueBc(order: ExportOrderRow, actorUserId: string) {
    const html = this.render('export-bc.html', {
      bcNumber: order.bc_number,
      version: order.bc_version,
      issuedAt: new Date().toISOString().slice(0, 10),
      clientName: this.clientName(order),
      agentLabel: order.agent_user_id || '—',
      countryCode: order.country_code,
      clientNote: order.client_note || '',
      lines: (order.lines ?? []).map((l) => ({
        ...l,
        characteristics: l.characteristics || '—',
        particularities: l.particularities || '—',
      })),
    });
    return this.persist({
      order,
      html,
      docType: 'BC',
      documentTypeName: 'export_bc',
      documentNumber: order.bc_number || (await this.docNumbers.next('BC', order.country_code)),
      version: order.bc_version,
      actorUserId,
      filePrefix: 'bc',
    });
  }

  async issueProforma(
    order: ExportOrderRow,
    actorUserId: string,
    bank: BankAccountSnapshot | null,
    fees: Array<{ label: string; fee_type: string; amount: number }>,
    meta: {
      subtotal: number;
      feesTotal: number;
      taxTotal: number;
      grandTotal: number;
      depositAmount: number;
      balanceAmount: number;
      depositRate: number;
      validityDays: number;
      validUntil: string;
      version: number;
    }
  ) {
    const docNumber = await this.docNumbers.next('PRO');
    const html = this.render('export-proforma.html', {
      docNumber,
      version: meta.version,
      validityDays: meta.validityDays,
      validUntil: meta.validUntil.slice(0, 10),
      clientName: this.clientName(order),
      bcNumber: order.bc_number,
      lines: order.lines ?? [],
      fees,
      subtotal: meta.subtotal.toFixed(2),
      feesTotal: meta.feesTotal.toFixed(2),
      taxTotal: meta.taxTotal.toFixed(2),
      grandTotal: meta.grandTotal.toFixed(2),
      depositAmount: meta.depositAmount.toFixed(2),
      balanceAmount: meta.balanceAmount.toFixed(2),
      depositRatePct: (meta.depositRate * 100).toFixed(1),
      bankBeneficiary: bank?.beneficiary ?? '—',
      bankInstitution: bank?.institution ?? '—',
      bankTransit: bank?.transit ?? '—',
      bankAccount: bank?.account_number ?? '—',
      bankSwift: bank?.swift ?? '—',
    });
    return this.persist({
      order,
      html,
      docType: 'PRO',
      documentTypeName: 'export_proforma',
      documentNumber: docNumber,
      version: meta.version,
      actorUserId,
      filePrefix: 'proforma',
      bank,
    });
  }

  async issueInvoice(
    order: ExportOrderRow,
    actorUserId: string,
    bank: BankAccountSnapshot | null,
    fees: Array<{ label: string; amount: number }>,
    meta: {
      subtotal: number;
      feesTotal: number;
      taxTotal: number;
      grandTotal: number;
      depositAmount: number;
      balanceAmount: number;
      approvedAt: string;
    }
  ) {
    const docNumber = await this.docNumbers.next('FAC');
    const html = this.render('export-invoice.html', {
      docNumber,
      issuedAt: new Date().toISOString().slice(0, 10),
      clientName: this.clientName(order),
      bcNumber: order.bc_number,
      approvedAt: meta.approvedAt.slice(0, 19),
      lines: order.lines ?? [],
      fees,
      subtotal: meta.subtotal.toFixed(2),
      feesTotal: meta.feesTotal.toFixed(2),
      taxTotal: meta.taxTotal.toFixed(2),
      grandTotal: meta.grandTotal.toFixed(2),
      depositAmount: meta.depositAmount.toFixed(2),
      balanceAmount: meta.balanceAmount.toFixed(2),
      bankBeneficiary: bank?.beneficiary ?? '—',
      bankInstitution: bank?.institution ?? '—',
      bankTransit: bank?.transit ?? '—',
      bankAccount: bank?.account_number ?? '—',
      bankSwift: bank?.swift ?? '—',
    });
    return this.persist({
      order,
      html,
      docType: 'FAC',
      documentTypeName: 'export_invoice',
      documentNumber: docNumber,
      version: 1,
      actorUserId,
      filePrefix: 'invoice',
      bank,
    });
  }

  async issueReceipt(
    order: ExportOrderRow,
    actorUserId: string,
    payment: {
      amount: number;
      currency: string;
      allocation: string;
      method: string;
      reference?: string;
      valueDate: string;
      remaining: number;
    }
  ) {
    const docNumber = await this.docNumbers.next('REC');
    const html = this.render('export-receipt.html', {
      docNumber,
      issuedAt: new Date().toISOString().slice(0, 10),
      bcNumber: order.bc_number,
      clientName: this.clientName(order),
      amount: payment.amount.toFixed(2),
      currency: payment.currency,
      amountWords: `${payment.amount.toFixed(2)} ${payment.currency}`,
      allocation: payment.allocation,
      method: payment.method,
      reference: payment.reference || '—',
      valueDate: payment.valueDate,
      remaining: payment.remaining.toFixed(2),
    });
    return this.persist({
      order,
      html,
      docType: 'REC',
      documentTypeName: 'export_receipt',
      documentNumber: docNumber,
      version: 1,
      actorUserId,
      filePrefix: 'receipt',
    });
  }

  private async persist(params: {
    order: ExportOrderRow;
    html: string;
    docType: string;
    documentTypeName: string;
    documentNumber: string;
    version: number;
    actorUserId: string;
    filePrefix: string;
    bank?: BankAccountSnapshot | null;
  }) {
    const sha256 = crypto.createHash('sha256').update(params.html).digest('hex');
    let uploadId: string | null = null;
    try {
      const upload = await this.pdf.generateHtmlPdf({
        html: params.html,
        fileName: `${params.filePrefix}-${params.documentNumber}.pdf`,
        documentTypeName: params.documentTypeName,
        userId: params.order.client_user_id,
        note: `${params.docType} ${params.documentNumber}`,
      });
      uploadId = upload.id;
    } catch (error: any) {
      this.logger.warn(
        `PDF render skipped for ${params.documentNumber}: ${error?.message}`
      );
    }
    const res = await this.hasura.executeMutation<{
      insert_export_documents_one: {
        id: string;
        document_number: string;
        doc_type: string;
        version_number: number;
      };
    }>(INSERT_DOCUMENT, {
      object: {
        export_order_id: params.order.id,
        doc_type: params.docType,
        document_number: params.documentNumber,
        version_number: params.version,
        upload_id: uploadId,
        sha256,
        bank_account_snapshot: params.bank ?? null,
        issued_by: params.actorUserId,
        locked: true,
      },
    });
    return res.insert_export_documents_one;
  }

  private render(file: string, data: Record<string, unknown>) {
    const full = path.join(__dirname, 'templates', file);
    const alt = path.join(
      process.cwd(),
      'apps/backend/src/export-orders/templates',
      file
    );
    const template = fs.existsSync(full)
      ? fs.readFileSync(full, 'utf8')
      : fs.readFileSync(alt, 'utf8');
    return Mustache.render(template, data);
  }

  private clientName(order: ExportOrderRow) {
    const u = order.client_user;
    if (!u) return 'Client';
    return [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Client';
  }
}
