import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  IsUUID,
} from 'class-validator';

const PRESET_IDS = [
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

const VEO_TIERS = ['lite', 'fast', 'standard'] as const;

export class GenerateAiReelDto {
  @ApiProperty({ enum: ['item', 'rental'] })
  @IsIn(['item', 'rental'])
  subjectType!: 'item' | 'rental';

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  subjectId!: string;

  @ApiProperty({ enum: PRESET_IDS })
  @IsIn(PRESET_IDS as unknown as string[])
  presetId!: (typeof PRESET_IDS)[number];

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
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
