import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class SignupStartProfileDto {
  @ApiPropertyOptional()
  vehicle_type_id?: string;

  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional({ enum: ['sell_items', 'rent_items'] })
  main_interest?: 'sell_items' | 'rent_items';
}

class SignupStartAddressDto {
  @ApiProperty()
  address_line_1!: string;

  @ApiProperty()
  country!: string;

  @ApiProperty()
  city!: string;

  @ApiProperty()
  state!: string;

  @ApiPropertyOptional({ description: 'GPS latitude from device auto-detect' })
  latitude?: number;

  @ApiPropertyOptional({ description: 'GPS longitude from device auto-detect' })
  longitude?: number;
}

export class SignupStartDto {
  @ApiProperty()
  first_name!: string;

  @ApiProperty()
  last_name!: string;

  @ApiPropertyOptional()
  email?: string | null;

  @ApiPropertyOptional()
  phone_number?: string | null;

  @ApiPropertyOptional({ enum: ['client', 'agent', 'business'] })
  user_type_id?: 'client' | 'agent' | 'business';

  @ApiPropertyOptional({ type: [String] })
  personas?: Array<'client' | 'agent' | 'business'>;

  @ApiProperty({ type: SignupStartProfileDto })
  profile!: SignupStartProfileDto;

  @ApiPropertyOptional({ type: SignupStartAddressDto })
  address?: SignupStartAddressDto;

  @ApiPropertyOptional({
    description: 'Optional 6-character agent referral code for business signup',
    example: 'AB12CD',
  })
  referral_agent_code?: string;
}
