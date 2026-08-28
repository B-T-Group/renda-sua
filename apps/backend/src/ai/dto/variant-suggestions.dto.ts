import { ApiProperty } from '@nestjs/swagger';

export class VariantSuggestionsDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Parent item id belonging to the current business',
  })
  itemId!: string;
}
