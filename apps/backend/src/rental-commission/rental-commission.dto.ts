import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

export const COMMISSION_RULE_SCOPES = ['default', 'country', 'category', 'merchant', 'promo'] as const;

export class CreateCommissionRuleDto {
  @ApiProperty({ enum: COMMISSION_RULE_SCOPES })
  @IsIn([...COMMISSION_RULE_SCOPES])
  scope!: (typeof COMMISSION_RULE_SCOPES)[number];

  @ApiProperty({ description: 'Whole basis points. 1500 = 15%.', minimum: 0, maximum: 10000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  rateBps!: number;

  @ApiProperty({ required: false, format: 'uuid', description: 'Required for merchant and promo scopes.' })
  @IsOptional()
  @IsUUID()
  businessId?: string;

  @ApiProperty({ required: false, format: 'uuid', description: 'Required for the category scope.' })
  @IsOptional()
  @IsUUID()
  rentalCategoryId?: string;

  @ApiProperty({ required: false, description: 'ISO country code. Required for the country scope.' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @ApiProperty({ required: false, description: 'Required for the promo scope.' })
  @IsOptional()
  @IsString()
  campaignCode?: string;

  @ApiProperty({ required: false, description: 'Defaults to now.' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiProperty({ required: false, description: 'Leave empty for an open-ended rule. A bounded rule never ends an open one.' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiProperty({ description: 'Why the rate changed. Kept on the rule.' })
  @IsString()
  @Length(3, 500)
  reason!: string;
}

export class CommissionPreviewQueryDto {
  @ApiProperty({ required: false, description: 'Total the merchant would quote instead of the server quote.' })
  @IsOptional()
  @Type(() => Number)
  totalOverride?: number;
}
