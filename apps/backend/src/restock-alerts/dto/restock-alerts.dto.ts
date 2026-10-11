import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class PatchRestockPreferencesDto {
  @ApiPropertyOptional({ description: 'Push restock alerts (default on)' })
  @IsOptional()
  @IsBoolean()
  push?: boolean;

  @ApiPropertyOptional({ description: 'WhatsApp restock alerts (default off)' })
  @IsOptional()
  @IsBoolean()
  whatsapp?: boolean;

  @ApiPropertyOptional({ description: 'SMS restock alerts (default off)' })
  @IsOptional()
  @IsBoolean()
  sms?: boolean;
}

export class SetItemAlertDto {
  @ApiProperty({ description: 'true = bell on, false = bell off' })
  @IsBoolean()
  enabled!: boolean;
}

export class ItemIdParamDto {
  @IsUUID()
  itemId!: string;
}

export class RestockLikesQueryDto {
  @ApiPropertyOptional({ enum: ['all', 'back_in_stock'], default: 'all' })
  @IsOptional()
  @IsIn(['all', 'back_in_stock'])
  filter?: 'all' | 'back_in_stock';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class StopRestockAlertsDto {
  @ApiProperty({ description: 'Signed token from the notification (data.stopToken)' })
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  token!: string;
}
