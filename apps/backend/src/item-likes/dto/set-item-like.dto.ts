import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetItemLikeDto {
  @ApiProperty({ description: 'Whether the catalog item is liked' })
  @IsBoolean()
  liked!: boolean;
}
