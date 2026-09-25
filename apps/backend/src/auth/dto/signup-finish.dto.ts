import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SignupStartDto } from './signup-start.dto';

const PERSONA_IDS = ['client', 'agent', 'business'] as const;

class SignupFinishProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicle_type_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: ['sell_items', 'rent_items'] })
  @IsOptional()
  @IsIn(['sell_items', 'rent_items'])
  main_interest?: 'sell_items' | 'rent_items';

  @ApiPropertyOptional({ enum: ['delivery', 'commercial', 'both'] })
  @IsOptional()
  @IsIn(['delivery', 'commercial', 'both'])
  agent_focus?: 'delivery' | 'commercial' | 'both';
}

export class SignupFinishDto {
  @ApiProperty({ description: 'Signup attempt id from auth flow v2' })
  @IsUUID()
  flowId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  first_name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  last_name!: string;

  @ApiProperty({ description: 'Must be true to create the account' })
  @IsBoolean()
  @Equals(true, { message: 'accept_terms must be true' })
  accept_terms!: boolean;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  country?: string;

  @ApiPropertyOptional({ type: SignupFinishProfileDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SignupFinishProfileDto)
  profile?: SignupFinishProfileDto;

  @ApiPropertyOptional({
    description: 'Optional agent referral code from SignupStartDto',
  })
  @IsOptional()
  @IsString()
  referral_agent_code?: string;
}

/** Server-side merge shape (SignupStartDto fields + finish body). */
export type SignupFinishPayload = Pick<
  SignupStartDto,
  | 'first_name'
  | 'last_name'
  | 'user_type_id'
  | 'personas'
  | 'country'
  | 'profile'
  | 'referral_agent_code'
>;
