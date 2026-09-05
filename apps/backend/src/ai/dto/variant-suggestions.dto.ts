import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class VariantSuggestionsDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Parent item id belonging to the current business',
  })
  @IsUUID()
  itemId!: string;

  @ApiProperty({
    description:
      'Business library image ids for the NEW variant photos (not parent listing images)',
    type: [String],
    minItems: 1,
    maxItems: 8,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsUUID('4', { each: true })
  imageIds!: string[];
}
