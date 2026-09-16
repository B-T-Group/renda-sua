import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetBusinessFollowDto {
  @ApiProperty({ description: 'Whether the user is following this business' })
  @IsBoolean()
  following!: boolean;
}
