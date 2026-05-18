import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsUUID,
} from 'class-validator';

export class CreateInventoryDto {
  @ApiProperty({ description: 'Business location id', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  business_location_id!: string;

  @ApiProperty({ description: 'Item id', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  item_id!: string;

  @ApiProperty({ description: 'Stock quantity' })
  @IsNumber()
  quantity!: number;

  @ApiProperty({ description: 'Reserved quantity' })
  @IsNumber()
  reserved_quantity!: number;

  @ApiProperty({ description: 'Reorder point' })
  @IsNumber()
  reorder_point!: number;

  @ApiProperty({ description: 'Reorder quantity' })
  @IsNumber()
  reorder_quantity!: number;

  @ApiProperty({ description: 'Unit cost' })
  @IsNumber()
  unit_cost!: number;

  @ApiProperty({ description: 'Selling price' })
  @IsNumber()
  selling_price!: number;

  @ApiProperty({ description: 'Whether inventory row is active' })
  @IsBoolean()
  is_active!: boolean;
}
