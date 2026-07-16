import { IsArray, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RequestAiImageCleanupDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Optional subset of item image IDs to clean',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  imageIds?: string[];
}
