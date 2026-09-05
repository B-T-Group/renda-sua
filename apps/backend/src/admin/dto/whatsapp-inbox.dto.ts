import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ListWhatsAppInboxQueryDto {
  @ApiPropertyOptional({ description: 'Search phone or linked user name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['open', 'closed', 'all'], default: 'open' })
  @IsOptional()
  @IsIn(['open', 'closed', 'all'])
  status?: 'open' | 'closed' | 'all';

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ListWhatsAppInboxMessagesQueryDto {
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class SendWhatsAppInboxMessageDto {
  @ApiProperty({ description: 'Free-form reply text', maxLength: 4000 })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}

export class PatchWhatsAppInboxConversationDto {
  @ApiPropertyOptional({ description: 'Clear unread count when true' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean()
  markRead?: boolean;

  @ApiPropertyOptional({ enum: ['open', 'closed'] })
  @IsOptional()
  @IsIn(['open', 'closed'])
  status?: 'open' | 'closed';
}
