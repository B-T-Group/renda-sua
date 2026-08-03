import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class QuickPublishDto {
  @ApiProperty({
    description: 'Business location id for inventory',
    format: 'uuid',
  })
  @IsUUID()
  locationId!: string;

  @ApiProperty({
    description: 'Stock quantity (defaults to 1)',
    required: false,
    default: 1,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  quantity?: number;

  @ApiProperty({
    description:
      'Selling price override. When omitted, uses the item catalog price.',
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  sellingPrice?: number;
}
