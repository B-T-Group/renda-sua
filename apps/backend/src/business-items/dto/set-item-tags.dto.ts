import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';

export class SetItemTagsDto {
  @ApiProperty({
    description: 'Tag names to assign (created if missing). Replaces existing tags.',
    type: [String],
    example: ['organic', 'fresh', 'local'],
  })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  tags!: string[];
}
