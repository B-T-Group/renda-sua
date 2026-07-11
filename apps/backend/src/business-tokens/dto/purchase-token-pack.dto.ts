import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

const PACK_IDS = ['pack_100', 'pack_1000', 'pack_5000'] as const;

export class PurchaseTokenPackDto {
  @ApiProperty({ enum: PACK_IDS })
  @IsIn(PACK_IDS as unknown as string[])
  packId!: (typeof PACK_IDS)[number];

  @ApiPropertyOptional({
    description: 'Required for mobile money rail',
  })
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
