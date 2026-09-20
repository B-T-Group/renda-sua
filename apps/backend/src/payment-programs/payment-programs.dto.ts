import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
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

export class UpdateScheduleDto {
  @IsString()
  name!: string;

  @IsIn(['daily', 'weekly', 'biweekly', 'monthly'])
  frequency!: 'daily' | 'weekly' | 'biweekly' | 'monthly';

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

export class UpdateAssignmentTermsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsString()
  endsAt?: string;
}

export class UpdateCashAdvanceProgramDto {
  @IsString()
  name!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  defaultLimit!: number;
}

export class SetActiveDto {
  @IsBoolean()
  isActive!: boolean;
}

export class UpdateFacilityDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  limitAmount?: number;

  @IsOptional()
  @IsString()
  endsAt?: string;
}

export class UpdateGrantDto {
  @IsOptional()
  @IsString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  memo?: string;
}

export class DrawCashAdvanceDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsIn(['CAD', 'USD', 'EUR', 'GBP', 'XAF', 'XOF', 'PHP'])
  currency!: string;
}

export class CreateCampaignDto {
  @IsString()
  name!: string;

  @IsString()
  countryCode!: string;

  @IsIn(['client', 'agent', 'business', 'any'])
  persona!: 'client' | 'agent' | 'business' | 'any';

  @IsISO8601()
  startsAt!: string;

  @IsISO8601()
  endsAt!: string;

  @IsIn(['CAD', 'USD', 'EUR', 'GBP', 'XAF', 'XOF', 'PHP'])
  currency!: string;

  @IsIn(['any_store', 'partner_businesses', 'specific_business'])
  storeScope!: 'any_store' | 'partner_businesses' | 'specific_business';

  @ValidateIf((row) => row.storeScope === 'specific_business')
  @IsUUID()
  businessId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  subjectAmount!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  subjectBonusIfReferred!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  storeCreditExpiresDays?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  referrerAmount!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxReferrerRewards?: number;
}
