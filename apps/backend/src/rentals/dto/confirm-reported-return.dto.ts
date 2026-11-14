import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ConfirmReportedReturnDto {
  @ApiProperty({ description: 'Why support is confirming this return' })
  @IsString()
  @MinLength(1)
  reason!: string;
}
