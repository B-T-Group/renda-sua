import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssistantChatMessageDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @ApiProperty({ maxLength: 4000 })
  @IsString()
  @MaxLength(4000)
  content!: string;
}

export class AssistantMarketContextDto {
  @ApiProperty({ description: 'ISO 3166-1 alpha-2 country code', example: 'CM' })
  @IsString()
  @Length(2, 2)
  country_code!: string;

  @ApiPropertyOptional({ description: 'State/region name', example: 'Littoral' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;
}

export class AssistantChatRequestDto {
  @ApiProperty({ type: [AssistantChatMessageDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AssistantChatMessageDto)
  messages!: AssistantChatMessageDto[];

  @ApiPropertyOptional({
    type: AssistantMarketContextDto,
    description: 'Market context from the app (country and optional state)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AssistantMarketContextDto)
  market?: AssistantMarketContextDto;

  @ApiPropertyOptional({
    description: 'Client-generated thread ID for analytics tracking',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4')
  threadId?: string;

  @ApiPropertyOptional({ description: 'Dates already chosen in the rental date chip' })
  @IsOptional()
  @IsObject()
  rentalDates?: {
    startDate?: string;
    endDate?: string;
    startAt?: string;
    endAt?: string;
  };

  @ApiPropertyOptional({ description: 'Listing ids for rental refs from the previous turn' })
  @IsOptional()
  @IsObject()
  rentalRefs?: Record<string, string>;
}

export class AssistantCardDto {
  @ApiProperty({ enum: ['item', 'order', 'rental', 'store', 'sign_in'] })
  kind!: string;

  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional()
  imageUrl?: string | null;

  @ApiPropertyOptional()
  priceLabel?: string;

  @ApiPropertyOptional()
  href?: string;

  @ApiPropertyOptional()
  secondaryHref?: string;

  @ApiPropertyOptional({ description: 'Rental card details. Older apps ignore this.' })
  rental?: Record<string, unknown>;
}

export class AssistantChatResponseDto {
  @ApiProperty()
  reply!: string;

  @ApiProperty({ description: 'Whether human support should take over' })
  handoff!: boolean;

  @ApiPropertyOptional({ type: [AssistantCardDto] })
  cards?: AssistantCardDto[];

  @ApiPropertyOptional({ description: 'Rental date chip, follow-up chips and estimate footnote' })
  rental?: Record<string, unknown>;
}
