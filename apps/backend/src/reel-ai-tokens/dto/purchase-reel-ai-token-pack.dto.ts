import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

const PACK_IDS = [
  'reel_ai_pack_1',
  'reel_ai_pack_5',
  'reel_ai_pack_15',
] as const;

export class PurchaseReelAiTokenPackDto {
  @ApiProperty({ enum: PACK_IDS })
  @IsIn(PACK_IDS as unknown as string[])
  packId!: (typeof PACK_IDS)[number];

  @ApiPropertyOptional({ description: 'Required for mobile money rail' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({
    enum: ['checkout', 'payment_sheet'],
    description: 'Stripe payment method when rail is stripe',
  })
  @IsOptional()
  @IsIn(['checkout', 'payment_sheet'])
  stripePaymentMethod?: 'checkout' | 'payment_sheet';
}
