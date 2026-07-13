import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

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
}
