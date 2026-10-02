import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export const BUSINESS_LOCATION_TYPES = [
  'store',
  'warehouse',
  'office',
  'pickup_point',
] as const;

/**
 * Allow-list of fields an owner may change via PATCH business-items/locations/:locationId.
 *
 * Deliberately absent (UAT S-9): id, business_id, address_id, commission fields and any other
 * column. The route is validated with `whitelist: true`, so unknown properties are stripped
 * before they can reach the admin-secret `business_locations_set_input` mutation;
 * `BusinessItemsService.updateBusinessLocation` enforces the same allow-list again.
 * Address changes go through the addresses API.
 */
export class UpdateBusinessLocationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  order_alert_phone?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  mobile_payment_phone_id?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ enum: BUSINESS_LOCATION_TYPES })
  @IsOptional()
  @IsIn(BUSINESS_LOCATION_TYPES)
  location_type?: (typeof BUSINESS_LOCATION_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @ApiPropertyOptional({
    description:
      'When true, order payouts are sent automatically to this location phone when configured.',
  })
  @IsOptional()
  @IsBoolean()
  auto_withdraw_commissions?: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Public URL for the location logo (S3 or external). Empty clears.',
  })
  @IsOptional()
  @IsString()
  logo_url?: string | null;

  @ApiPropertyOptional({
    description:
      'Owner-only. When true (and the server kill switch is on), clients pay AFTER the store confirms (MoMo pickup/delivery, ASAP). Default false.',
  })
  @IsOptional()
  @IsBoolean()
  pay_at_confirm?: boolean;
}

/** Keys the service copies into business_locations_set_input (single source of truth). */
export const UPDATABLE_BUSINESS_LOCATION_FIELDS = [
  'name',
  'phone',
  'order_alert_phone',
  'mobile_payment_phone_id',
  'email',
  'location_type',
  'is_active',
  'is_primary',
  'auto_withdraw_commissions',
  'logo_url',
  'pay_at_confirm',
] as const satisfies ReadonlyArray<keyof UpdateBusinessLocationDto>;
