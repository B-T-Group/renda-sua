import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateScheduleDto {
  @IsString()
  name!: string;

  @IsIn(['daily', 'weekly', 'biweekly', 'monthly'])
  frequency!: 'daily' | 'weekly' | 'biweekly' | 'monthly';

  @IsIn(['CAD', 'USD', 'EUR', 'GBP', 'XAF', 'XOF', 'PHP'])
  currency!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  defaultAmount!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  defaultDurationDays?: number;
}

export class AssignScheduleDto {
  @IsUUID()
  agentId!: string;

  @IsString()
  startsAt!: string;

  @IsOptional()
  @IsString()
  endsAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount?: number;
}

export class SetStatusDto {
  @IsIn(['active', 'paused', 'ended', 'cancelled', 'closed'])
  status!: string;
}

export class CreateCashAdvanceProgramDto {
  @IsString()
  name!: string;

  @IsIn(['CAD', 'USD', 'EUR', 'GBP', 'XAF', 'XOF', 'PHP'])
  currency!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  defaultLimit!: number;
}

export class OpenFacilityDto {
  @IsUUID()
  userId!: string;

  @IsIn(['CAD', 'USD', 'EUR', 'GBP', 'XAF', 'XOF', 'PHP'])
  currency!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  limitAmount!: number;

  @IsOptional()
  @IsString()
  endsAt?: string;

  @IsOptional()
  @IsString()
  preferredLanguage?: string;
}

export class GrantCreditDto {
  @IsUUID()
  userId!: string;

  @IsIn(['CAD', 'USD', 'EUR', 'GBP', 'XAF', 'XOF', 'PHP'])
  currency!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsIn(['any_store', 'partner_businesses', 'specific_business'])
  applicability!: 'any_store' | 'partner_businesses' | 'specific_business';

  @IsOptional()
  @IsUUID()
  businessId?: string;

  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  memo?: string;

  @IsOptional()
  @IsString()
  preferredLanguage?: string;
}

export class PartnerBusinessDto {
  @IsUUID()
  businessId!: string;

  @IsBoolean()
  isActive!: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class DrawCashAdvanceDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsIn(['CAD', 'USD', 'EUR', 'GBP', 'XAF', 'XOF', 'PHP'])
  currency!: string;
}
