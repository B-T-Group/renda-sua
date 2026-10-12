import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class EnsureAgentContractDto {
  @ApiPropertyOptional({ enum: ['en', 'fr'], description: 'Contract language' })
  @IsOptional()
  @IsIn(['en', 'fr'])
  language?: 'en' | 'fr';

  @ApiPropertyOptional({ description: 'Nationality written into the agreement' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nationality?: string;

  @ApiPropertyOptional({
    description: 'Government ID number, required for the Canada French template',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  idNumber?: string;
}
