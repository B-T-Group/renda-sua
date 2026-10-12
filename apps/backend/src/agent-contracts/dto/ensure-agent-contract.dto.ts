import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class EnsureAgentContractDto {
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
