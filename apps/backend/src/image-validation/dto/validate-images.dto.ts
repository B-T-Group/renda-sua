import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class ValidateImageInputDto {
  @ApiProperty({ description: 'Base64-encoded image data (no data: prefix)' })
  @IsString()
  data!: string;

  @ApiProperty({
    example: 'image/jpeg',
    description: 'MIME type: image/jpeg, image/png, image/webp, image/heic',
  })
  @IsString()
  mimeType!: string;

  @ApiPropertyOptional({ example: 'product-photo.jpg' })
  @IsOptional()
  @IsString()
  fileName?: string;
}

export class ValidateImagesDto {
  @ApiProperty({ type: [ValidateImageInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ValidateImageInputDto)
  images!: ValidateImageInputDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  rentalItemId?: string;
}
