import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import {
  ManufacturerConfirmDto,
  RecordShipmentDto,
} from './dto/admin-export-order.dto';
import { EXPORT_EVENTS } from './export-order.statuses';
import { ExportOrdersTransitionService } from './export-orders-transition.service';
import {
  COUNT_SUPPLIER_BALANCE,
  INSERT_MFR_QUOTE,
  INSERT_SHIPMENT,
  LIST_EXPIRING,
} from './export-orders.queries';

@Injectable()
export class ExportOrdersFulfillmentService {
  private readonly logger = new Logger(ExportOrdersFulfillmentService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly hasuraUser: HasuraUserService,
    private readonly transitions: ExportOrdersTransitionService
  ) {}

  async manufacturerConfirm(orderId: string, dto: ManufacturerConfirmDto) {
    const user = await this.hasuraUser.getUser();
    const order = await this.transitions.getOrder(orderId);
    if (user.business?.id !== order.business_id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    if (order.status !== 'MFR_QUOTE' && order.status !== 'IN_PRODUCTION') {
      throw new HttpException('Invalid status', HttpStatus.BAD_REQUEST);
    }
    await this.hasura.executeMutation(INSERT_MFR_QUOTE, {
      object: {
        export_order_id: orderId,
        lead_time_days: dto.leadTimeDays ?? null,
        notes: dto.notes?.trim() || null,
        attachment_upload_id: dto.attachmentUploadId ?? null,
        confirmed_by_user_id: user.id,
        confirmed_at: new Date().toISOString(),
      },
    });
    return this.transitions.getOrder(orderId);
  }

  async markReady(orderId: string) {
    const user = await this.hasuraUser.getUser();
    const order = await this.transitions.getOrder(orderId);
    if (!user.business?.id || user.business.id !== order.business_id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    if (order.status !== 'IN_PRODUCTION') {
      throw new HttpException('Must be IN_PRODUCTION', HttpStatus.BAD_REQUEST);
    }
    await this.transitions.transition({
      orderId,
      to: 'READY',
      eventName: EXPORT_EVENTS.productionReady,
      actorUserId: user.id,
      actorRole: 'business',
    });
    return this.transitions.transition({
      orderId,
      to: 'BALANCE_REQUIRED',
      eventName: EXPORT_EVENTS.balanceOptionSelected,
      actorUserId: user.id,
      actorRole: 'system',
    });
  }

  async adminMarkReady(orderId: string) {
    const user = await this.hasuraUser.getUser();
    const order = await this.transitions.getOrder(orderId);
    if (order.status !== 'IN_PRODUCTION') {
      throw new HttpException('Must be IN_PRODUCTION', HttpStatus.BAD_REQUEST);
    }
    await this.transitions.transition({
      orderId,
      to: 'READY',
      eventName: EXPORT_EVENTS.productionReady,
      actorUserId: user.id,
      actorRole: 'admin',
    });
    return this.transitions.transition({
      orderId,
      to: 'BALANCE_REQUIRED',
      eventName: EXPORT_EVENTS.balanceOptionSelected,
      actorUserId: user.id,
      actorRole: 'system',
    });
  }

  async ship(orderId: string, dto: RecordShipmentDto) {
    const user = await this.hasuraUser.getUser();
    const order = await this.transitions.getOrder(orderId);
    if (!['PAID_IN_FULL', 'FINANCED_30', 'FINANCED_60'].includes(order.status)) {
      throw new HttpException(
        'Pay or finance balance before shipping',
        HttpStatus.BAD_REQUEST
      );
    }
    const bal = await this.hasura.executeQuery<{
      export_supplier_payments_aggregate: { aggregate: { count: number } };
    }>(COUNT_SUPPLIER_BALANCE, { orderId });
    if ((bal.export_supplier_payments_aggregate?.aggregate?.count ?? 0) < 1) {
      throw new HttpException(
        'Manufacturer balance must be paid before SHIPPED',
        HttpStatus.BAD_REQUEST
      );
    }
    await this.hasura.executeMutation(INSERT_SHIPMENT, {
      object: {
        export_order_id: orderId,
        carrier: dto.carrier ?? null,
        tracking_number: dto.trackingNumber ?? null,
        bill_of_lading: dto.billOfLading ?? null,
        certificate_of_origin: dto.certificateOfOrigin ?? null,
        notes: dto.notes ?? null,
        dispatched_at: new Date().toISOString(),
      },
    });
    return this.transitions.transition({
      orderId,
      to: 'SHIPPED',
      eventName: EXPORT_EVENTS.shipmentDispatched,
      actorUserId: user.id,
      actorRole: 'admin',
    });
  }

  async processExpiries() {
    const now = new Date().toISOString();
    const res = await this.hasura.executeQuery<{
      export_orders: Array<{
        id: string;
        status: string;
        deposit_due_at: string | null;
      }>;
    }>(LIST_EXPIRING, {
      now,
      statuses: ['SUBMITTED', 'PROFORMA_ISSUED', 'DEPOSIT_REQUIRED'],
    });
    for (const row of res.export_orders ?? []) {
      try {
        if (
          row.status === 'DEPOSIT_REQUIRED' &&
          row.deposit_due_at &&
          row.deposit_due_at <= now
        ) {
          await this.transitions.transition({
            orderId: row.id,
            to: 'CANCELLED',
            eventName: 'order.cancelled_deposit_timeout',
            actorRole: 'system',
          });
        }
      } catch (error: any) {
        this.logger.warn(`expiry ${row.id}: ${error?.message}`);
      }
    }
  }
}
