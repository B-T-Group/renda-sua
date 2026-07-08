import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StripeTaxCodeResponseDto {
  @ApiProperty({ example: 'txcd_99999999' })
  id!: string;

  @ApiProperty({ example: 'General - Tangible Goods' })
  name!: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiPropertyOptional({ example: 'General' })
  groupName?: string | null;
}

export class StripeTaxCodesListResponseDto {
  @ApiProperty({ type: [StripeTaxCodeResponseDto] })
  codes!: StripeTaxCodeResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  offset!: number;
}

export class StripeTaxSyncResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty()
  upserted!: number;

  @ApiProperty()
  deactivated!: number;

  @ApiProperty()
  message!: string;
}
