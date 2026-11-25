import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class MarketLanesQueryDto {
  @ApiPropertyOptional({
    description: 'ISO-2 country code for the shopper market',
    example: 'CM',
  })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country_code?: string;
}
