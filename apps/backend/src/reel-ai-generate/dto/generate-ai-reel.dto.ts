import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  IsUUID,
} from 'class-validator';

/** Current presets plus legacy ids (normalized server-side). */
const PRESET_IDS = [
  'dynamic',
  'premium',
  'lifestyle',
  'social',
  'product_centered',
  'explosive',
  'exciting',
  'luxury',
  'fresh',
  'unboxing',
  'ugc',
  'cozy',
  'outdoor',
  'custom',
] as const;

const VEO_TIERS = ['fast', 'standard'] as const;

export class GenerateAiReelDto {
  @ApiProperty({ enum: ['item', 'rental'] })
  @IsIn(['item', 'rental'])
  subjectType!: 'item' | 'rental';

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  subjectId!: string;

  @ApiProperty({
    enum: ['dynamic', 'premium', 'lifestyle', 'social'],
    description:
      'Creative style. Legacy ids (e.g. luxury, ugc) are accepted and mapped.',
  })
  @IsIn(PRESET_IDS as unknown as string[])
  presetId!: (typeof PRESET_IDS)[number];

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  prompt?: string;

  @ApiPropertyOptional({ maxLength: 2200 })
  @IsOptional()
  @IsString()
  @MaxLength(2200)
  caption?: string;

  @ApiProperty({ minLength: 2, maxLength: 2 })
  @Length(2, 2)
  marketCountry!: string;

  @ApiPropertyOptional({
    enum: VEO_TIERS,
    default: 'fast',
    description: 'Veo model tier. Default fast.',
  })
  @IsOptional()
  @IsIn(VEO_TIERS as unknown as string[])
  tier?: (typeof VEO_TIERS)[number];
}
