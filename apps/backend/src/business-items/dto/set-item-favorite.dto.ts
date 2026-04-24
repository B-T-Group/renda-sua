import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetItemFavoriteDto {
  @ApiProperty({ description: 'Whether the item is marked as a favorite' })
  @IsBoolean()
  favorited!: boolean;
}
