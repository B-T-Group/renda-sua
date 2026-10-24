import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class GiftAiTokensDto {
  @ApiProperty({
    description: 'Recipient referral code (6 alphanumeric characters)',
    example: 'AB12CD',
  })
  @IsString()
  @Matches(/^[A-Za-z0-9]{6}$/, {
    message: 'Referral code must be 6 alphanumeric characters',
  })
  code!: string;

  @ApiProperty({ description: 'Tokens to gift (10–5000)', example: 100 })
  @IsInt()
  @Min(10)
  @Max(5000)
  amount!: number;

  @ApiProperty({
    description: 'Client-generated idempotency key for this confirm dialog',
    example: 'gift-550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @MaxLength(128)
  idempotencyKey!: string;
}
