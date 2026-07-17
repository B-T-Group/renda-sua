import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const SOURCE_TYPE_ENUM = [
  'item_image',
  'rental_item_image',
  'item_variant_image',
] as const;

type SourceTypeValue = (typeof SOURCE_TYPE_ENUM)[number];

export class ProcessThumbnailDto {
  @ApiProperty({ enum: SOURCE_TYPE_ENUM })
  sourceType!: SourceTypeValue;

  @ApiProperty({ format: 'uuid' })
  imageId!: string;
}

export class BackfillThumbnailsDto {
  @ApiPropertyOptional({
    enum: SOURCE_TYPE_ENUM,
    isArray: true,
    description: 'Defaults to all source types',
  })
  sourceTypes?: SourceTypeValue[];

  @ApiPropertyOptional({ default: 200, maximum: 500 })
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Keyset cursors per source type (created_at) from a previous page, e.g. { "item_image": "2026-01-01T00:00:00Z" }',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  cursors?: Partial<Record<SourceTypeValue, string>>;
}
