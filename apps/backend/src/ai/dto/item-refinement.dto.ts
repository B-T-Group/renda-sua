import { ApiProperty } from '@nestjs/swagger';

export class ItemRefinementDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Item id belonging to the current business',
  })
  itemId!: string;
}
