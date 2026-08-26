import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  ORDER_RISK_TYPES,
  type OrderRiskType,
} from '../order-risk.types';

export enum OrderStatusFilter {
  ALL = 'all',
  PENDING = 'pending',
  PENDING_PAYMENT = 'pending_payment',
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  READY_FOR_PICKUP = 'ready_for_pickup',
  ASSIGNED_TO_AGENT = 'assigned_to_agent',
  PICKED_UP = 'picked_up',
  IN_TRANSIT = 'in_transit',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  AWAITING_SHIPMENT = 'awaiting_shipment',
  SHIPPED = 'shipped',
  IN_DELIVERY = 'in_delivery',
}

/** Attention-first queue by default; ALL widens to every active order. */
export enum AdminOrderQueue {
  AT_RISK = 'at_risk',
  ALL = 'all',
}

export enum RiskSeverityFilter {
  ALL = 'all',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export enum FulfillmentMethodFilter {
  DELIVERY = 'delivery',
  PICKUP = 'pickup',
  SHIPPING = 'shipping',
}

export class GetAdminOrdersDto {
  @ApiPropertyOptional({
    enum: AdminOrderQueue,
    default: AdminOrderQueue.AT_RISK,
  })
  @IsOptional()
  @IsEnum(AdminOrderQueue)
  queue?: AdminOrderQueue = AdminOrderQueue.AT_RISK;

  @ApiPropertyOptional({ enum: OrderStatusFilter, default: OrderStatusFilter.ALL })
  @IsOptional()
  @IsEnum(OrderStatusFilter)
  status?: OrderStatusFilter;

  @ApiPropertyOptional({
    enum: RiskSeverityFilter,
    default: RiskSeverityFilter.ALL,
  })
  @IsOptional()
  @IsEnum(RiskSeverityFilter)
  severity?: RiskSeverityFilter;

  @ApiPropertyOptional({ enum: ORDER_RISK_TYPES })
  @IsOptional()
  @IsIn(ORDER_RISK_TYPES)
  risk_type?: OrderRiskType;

  @ApiPropertyOptional({ enum: FulfillmentMethodFilter })
  @IsOptional()
  @IsEnum(FulfillmentMethodFilter)
  fulfillment_method?: FulfillmentMethodFilter;

  @ApiPropertyOptional({ description: 'Order number, client name/email, or business' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

/** Statistics windows, evaluated on orders.created_at. */
export enum AdminOrderStatsPeriod {
  TODAY = 'today',
  LAST_7_DAYS = '7d',
  LAST_30_DAYS = '30d',
  ALL = 'all',
}

export class GetAdminOrderStatsDto {
  @ApiPropertyOptional({
    enum: AdminOrderStatsPeriod,
    default: AdminOrderStatsPeriod.LAST_7_DAYS,
  })
  @IsOptional()
  @IsEnum(AdminOrderStatsPeriod)
  period?: AdminOrderStatsPeriod = AdminOrderStatsPeriod.LAST_7_DAYS;
}

export class UnassignRedispatchDto {
  @ApiPropertyOptional({ description: 'Reason for unassigning and redispatching' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ description: 'New order status' })
  @IsString()
  status!: string;

  @ApiProperty({
    description: 'Why the status is being corrected manually (audited)',
  })
  @IsString()
  reason!: string;
}

export class AddAdminNoteDto {
  @ApiProperty({ description: 'Admin note content' })
  @IsString()
  note!: string;
}

export class AcknowledgeRiskIncidentDto {
  @ApiPropertyOptional({ description: 'What the operator is doing about it' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    description: 'Close the incident instead of only acknowledging it',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  resolve?: boolean;
}

export const ORDER_CONTACT_RECIPIENT_TYPES = [
  'client',
  'business',
  'agent',
] as const;

export type OrderContactRecipientType =
  (typeof ORDER_CONTACT_RECIPIENT_TYPES)[number];

export class SendOrderContactMessageDto {
  @ApiProperty({ description: 'In-app message body' })
  @IsString()
  message!: string;

  @ApiProperty({
    description: 'Order participant to notify',
    enum: ORDER_CONTACT_RECIPIENT_TYPES,
  })
  @IsIn(ORDER_CONTACT_RECIPIENT_TYPES)
  recipient_type!: OrderContactRecipientType;
}

export class SendOrderContactEmailDto {
  @ApiProperty({ description: 'Email subject' })
  @IsString()
  subject!: string;

  @ApiProperty({ description: 'Email body (HTML allowed)' })
  @IsString()
  message!: string;

  @ApiProperty({ enum: ORDER_CONTACT_RECIPIENT_TYPES })
  @IsIn(ORDER_CONTACT_RECIPIENT_TYPES)
  recipient_type!: OrderContactRecipientType;
}

export class SendOrderContactSmsDto {
  @ApiProperty({ description: 'SMS body' })
  @IsString()
  message!: string;

  @ApiProperty({ enum: ORDER_CONTACT_RECIPIENT_TYPES })
  @IsIn(ORDER_CONTACT_RECIPIENT_TYPES)
  recipient_type!: OrderContactRecipientType;
}
