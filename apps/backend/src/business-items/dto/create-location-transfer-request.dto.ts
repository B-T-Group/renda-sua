import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class CreateLocationTransferRequestDto {
  @ApiProperty({ description: 'Destination business UUID' })
  @IsUUID()
  toBusinessId!: string;

  @ApiProperty({
    description: 'Must match the destination business name (case-insensitive)',
  })
  @IsString()
  @IsNotEmpty()
  confirmBusinessName!: string;

  @ApiPropertyOptional({
    enum: ['location_ownership', 'inventory_merge'],
    default: 'location_ownership',
  })
  @IsOptional()
  @IsIn(['location_ownership', 'inventory_merge'])
  mode?: 'location_ownership' | 'inventory_merge';

  @ApiPropertyOptional({
    description:
      'Required when mode is inventory_merge: destination business location UUID',
  })
  @ValidateIf((o) => (o.mode ?? 'location_ownership') === 'inventory_merge')
  @IsUUID()
  toLocationId?: string;
}
