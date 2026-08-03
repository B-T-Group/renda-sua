import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class ImageItemSuggestionsDto {
  @ApiProperty({
    description: 'Legacy single image id',
    required: false,
    format: 'uuid',
  })
  @IsUUID()
  @IsOptional()
  imageId?: string;

  @ApiProperty({
    description: 'All photo ids to analyze (preferred)',
    required: false,
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  imageIds?: string[];

  @ApiProperty({
    description:
      'Optional short merchant hint describing what was photographed (e.g. "Coca-Cola Zero 1.5L")',
    required: false,
    maxLength: 200,
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  hint?: string;
}
