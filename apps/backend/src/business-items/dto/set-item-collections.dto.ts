import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class SetItemCollectionsDto {
  @ApiProperty({ type: [String], description: 'Collection UUIDs to assign to the item' })
  @IsArray()
  @IsUUID('4', { each: true })
  collectionIds!: string[];
}
