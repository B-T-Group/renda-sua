import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInviteDto {
  @ApiProperty({ example: 'jane@example.com' })
  email!: string;

  @ApiProperty({ format: 'uuid' })
  business_location_id!: string;

  @ApiProperty({ format: 'uuid' })
  role_id!: string;

  @ApiPropertyOptional()
  first_name?: string;

  @ApiPropertyOptional()
  last_name?: string;
}
