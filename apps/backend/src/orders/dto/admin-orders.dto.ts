import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';

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

export enum RiskLevelFilter {
  ALL = 'all',
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export class GetAdminOrdersDto {
  @ApiPropertyOptional({ enum: OrderStatusFilter, default: OrderStatusFilter.ALL })
  @IsOptional()
  @IsEnum(OrderStatusFilter)
  status?: OrderStatusFilter;

  @ApiPropertyOptional({ enum: RiskLevelFilter, default: RiskLevelFilter.ALL })
  @IsOptional()
  @IsEnum(RiskLevelFilter)
  risk_level?: RiskLevelFilter;

  @ApiPropertyOptional({ description: 'Search by order number or client name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
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

  @ApiPropertyOptional({ description: 'Admin notes for status change' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddAdminNoteDto {
  @ApiProperty({ description: 'Admin note content' })
  @IsString()
  note!: string;
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
