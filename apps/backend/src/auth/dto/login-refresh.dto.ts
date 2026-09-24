import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { PERSONA_IDS } from './signup-start.dto';

export class LoginRefreshDto {
  @ApiPropertyOptional({ enum: PERSONA_IDS })
  @IsOptional()
  @IsIn(PERSONA_IDS)
  active_persona?: 'client' | 'agent' | 'business';

  @ApiPropertyOptional({
    description: 'Bypass cached access token and refresh from Auth0',
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
