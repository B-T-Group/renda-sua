import { ApiProperty } from '@nestjs/swagger';

export class CurrentLocationDto {
  @ApiProperty({ example: 3.848, minimum: -90, maximum: 90 })
  latitude!: number;

  @ApiProperty({ example: 11.502, minimum: -180, maximum: 180 })
  longitude!: number;
}
