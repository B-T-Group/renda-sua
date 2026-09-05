import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsISO31661Alpha2,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateRecipientDto {
  @ApiProperty({
    description: 'ISO 3166-1 alpha-2 country code of the fulfillment country',
    example: 'GA',
  })
  @IsISO31661Alpha2()
  country!: string;

  @ApiProperty({ description: 'Full name of the recipient' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'E.164 phone number in the fulfillment country',
    example: '+241077123456',
  })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiPropertyOptional({
    description: 'Send updates via WhatsApp instead of SMS',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  notify_whatsapp?: boolean;
}

export class UpdateRecipientDto {
  @ApiPropertyOptional({ description: 'Full name of the recipient' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({
    description: 'E.164 phone number in the fulfillment country',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Send updates via WhatsApp instead of SMS',
  })
  @IsOptional()
  @IsBoolean()
  notify_whatsapp?: boolean;
}

export class RecipientResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  user_id!: string;

  @ApiProperty({ description: 'ISO 3166-1 alpha-2 country code' })
  country!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: 'E.164 phone number' })
  phone!: string;

  @ApiProperty()
  notify_whatsapp!: boolean;

  @ApiProperty()
  created_at!: string;

  @ApiProperty()
  updated_at!: string;
}

export class ListRecipientsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by ISO 3166-1 alpha-2 country code',
    example: 'GA',
  })
  @IsOptional()
  @IsISO31661Alpha2()
  country?: string;
}
