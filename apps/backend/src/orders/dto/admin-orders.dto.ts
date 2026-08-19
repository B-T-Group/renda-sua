import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsUUID, IsInt, Min } from 'class-validator';

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
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

export class ReassignAgentDto {
  @ApiProperty({ description: 'New agent ID to assign' })
  @IsUUID()
  agent_id: string;

  @ApiPropertyOptional({ description: 'Reason for reassignment' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ description: 'New order status' })
  @IsString()
  status: string;

  @ApiPropertyOptional({ description: 'Admin notes for status change' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddAdminNoteDto {
  @ApiProperty({ description: 'Admin note content' })
  @IsString()
  note: string;
}
