import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CleanupImageSelectionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  imageId!: string;

  @ApiProperty({ enum: ['rembg', 'ai'] })
  @IsIn(['rembg', 'ai'])
  kind!: 'rembg' | 'ai';
}

export class RequestAiImageCleanupDto {
  @ApiPropertyOptional({
    type: [String],
    description:
      'Optional subset of image IDs to clean as AI (web compat). Prefer selections.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  imageIds?: string[];

  @ApiPropertyOptional({
    type: [CleanupImageSelectionDto],
    description:
      'Per-image cleanup kind. When omitted, imageIds (or all eligible) default to ai.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CleanupImageSelectionDto)
  selections?: CleanupImageSelectionDto[];
}

export class SetImageActiveVersionDto {
  @ApiProperty({ enum: ['original', 'rembg', 'enhanced'] })
  @IsIn(['original', 'rembg', 'enhanced'])
  version!: 'original' | 'rembg' | 'enhanced';
}
