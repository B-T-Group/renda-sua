import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateItemVariantImageDto {
  @ApiPropertyOptional()
  @IsString()
  @MinLength(1)
  image_url!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  alt_text?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  caption?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  display_order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;
}
