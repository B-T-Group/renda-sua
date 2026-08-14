import { ApiPropertyOptional } from '@nestjs/swagger';

export class AcceptInviteDto {
  @ApiPropertyOptional()
  first_name?: string;

  @ApiPropertyOptional()
  last_name?: string;
}
