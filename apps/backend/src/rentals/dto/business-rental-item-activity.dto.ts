import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class BusinessRentalItemActivityQueryDto {
  @ApiPropertyOptional({ enum: ['all', 'upcoming', 'past'], default: 'all' })
  @IsOptional()
  @IsIn(['all', 'upcoming', 'past'])
  scope?: 'all' | 'upcoming' | 'past';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
