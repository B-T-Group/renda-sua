import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const PERSONA_IDS = ['client', 'agent', 'business'] as const;
const MAIN_INTERESTS = ['sell_items', 'rent_items'] as const;
const AGENT_FOCUSES = ['delivery', 'commercial', 'both'] as const;

class SignupStartProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicle_type_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ enum: MAIN_INTERESTS })
  @IsOptional()
  @IsIn(MAIN_INTERESTS)
  main_interest?: 'sell_items' | 'rent_items';

  @ApiPropertyOptional({ enum: AGENT_FOCUSES })
  @IsOptional()
  @IsIn(AGENT_FOCUSES)
  agent_focus?: 'delivery' | 'commercial' | 'both';
}

/** @deprecated Prefer `country` + `store_location`. Kept for mobile / in-flight clients. */
class SignupStartAddressDto {
  @ApiProperty()
  @IsString()
  @MinLength(0)
  address_line_1!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(2)
  country!: string;

  @ApiProperty()
  @IsString()
  city!: string;

  @ApiProperty()
  @IsString()
  state!: string;

  @ApiPropertyOptional({ description: 'GPS latitude from device auto-detect' })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ description: 'GPS longitude from device auto-detect' })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postal_code?: string;
}

class SignupStoreLocationDto {
  @ApiProperty({ description: 'Street address for the first business location' })
  @IsString()
  @MinLength(1)
  street!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  city!: string;

  @ApiProperty({ description: 'Province / region / state' })
  @IsString()
  @MinLength(1)
  region!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postal_code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitude?: number;
}

export class SignupStartDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  first_name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  last_name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  email?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  phone_number?: string | null;

  @ApiPropertyOptional({ enum: PERSONA_IDS })
  @IsOptional()
  @IsIn(PERSONA_IDS)
  user_type_id?: 'client' | 'agent' | 'business';

  @ApiPropertyOptional({ type: [String], enum: PERSONA_IDS })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsIn(PERSONA_IDS, { each: true })
  personas?: Array<'client' | 'agent' | 'business'>;

  @ApiProperty({ type: SignupStartProfileDto })
  @ValidateNested()
  @Type(() => SignupStartProfileDto)
  profile!: SignupStartProfileDto;

  @ApiPropertyOptional({
    description: 'ISO 3166-1 alpha-2 country code (preferred over address.country)',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(2)
  country?: string;

  @ApiPropertyOptional({
    type: SignupStoreLocationDto,
    description: 'First business location when Business persona is selected',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SignupStoreLocationDto)
  store_location?: SignupStoreLocationDto;

  /** @deprecated Prefer country + store_location */
  @ApiPropertyOptional({ type: SignupStartAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SignupStartAddressDto)
  address?: SignupStartAddressDto;

  @ApiPropertyOptional({
    description: 'Optional 6-character agent referral code for business signup',
    example: 'AB12CD',
  })
  @IsOptional()
  @IsString()
  @MaxLength(6)
  referral_agent_code?: string;

  @ApiPropertyOptional({
    description: 'Meta _fbc cookie (Click ID); do not hash',
  })
  @IsOptional()
  @IsString()
  fbc?: string;

  @ApiPropertyOptional({
    description: 'Meta _fbp cookie (Browser ID); do not hash',
  })
  @IsOptional()
  @IsString()
  fbp?: string;

  @ApiPropertyOptional({
    description: 'Page URL for Meta CompleteRegistration event_source_url',
  })
  @IsOptional()
  @IsString()
  eventSourceUrl?: string;

  @ApiPropertyOptional({
    enum: ['email', 'sms'],
    description:
      'Preferred OTP channel. Server validates contact exists for the channel.',
  })
  @IsOptional()
  @IsIn(['email', 'sms'] as const)
  verification_channel?: 'email' | 'sms';
}
