import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class TestWhatsAppTemplateDto {
  @ApiProperty({
    description: 'Recipient phone (E.164, optional leading +)',
    example: '+15145550123',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[1-9]\d{6,14}$/, {
    message: 'to must be an international phone number',
  })
  to!: string;

  @ApiProperty({
    description:
      'Internal catalog key (e.g. order_created_business) or Meta name (e.g. rs_order_created)',
    example: 'order_created_business',
  })
  @IsString()
  @IsNotEmpty()
  templateId!: string;

  @ApiPropertyOptional({ enum: ['en', 'fr'], default: 'en' })
  @IsOptional()
  @IsIn(['en', 'fr'])
  locale?: 'en' | 'fr';

  @ApiProperty({
    description: 'Body variables required by the template (see GET catalog)',
    additionalProperties: { type: 'string' },
    example: {
      orderNumber: '20123398',
      customerName: 'Ada',
      pickupWindow: '15 min',
    },
  })
  @IsObject()
  variables!: Record<string, string>;

  @ApiPropertyOptional({
    description:
      'Full HTTPS CTA. Prefer entityId for templates with a dynamic URL button.',
    example:
      'https://rendasua.com/app/orders/11111111-2222-4333-8555-666666666666',
  })
  @IsOptional()
  @IsString()
  ctaUrl?: string;

  @ApiPropertyOptional({
    description:
      'Order / rental / item id used as the dynamic URL button {{1}} suffix',
    example: '11111111-2222-4333-8555-666666666666',
  })
  @IsOptional()
  @IsString()
  entityId?: string;
}
