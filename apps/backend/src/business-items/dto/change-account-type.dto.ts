import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { BUSINESS_ACCOUNT_TYPE_VALUES } from '../../commissions/business-account-type';

export class ChangeAccountTypeDto {
  @ApiProperty({
    description: 'New account type for the business',
    enum: BUSINESS_ACCOUNT_TYPE_VALUES,
    example: 'PREMIUM',
  })
  @IsIn(BUSINESS_ACCOUNT_TYPE_VALUES)
  accountType!: string;
}

export class AdminChangeAccountTypeDto {
  @ApiProperty({
    description: 'New account type for the business',
    enum: BUSINESS_ACCOUNT_TYPE_VALUES,
    example: 'ELITE',
  })
  @IsIn(BUSINESS_ACCOUNT_TYPE_VALUES)
  accountType!: string;

  @ApiPropertyOptional({
    description: 'Optional reason for the admin change (stored in audit history)',
    example: 'Manually upgraded as part of onboarding deal',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
