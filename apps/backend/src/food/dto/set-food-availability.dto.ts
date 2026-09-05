import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetFoodAvailabilityDto {
  @ApiProperty({
    description:
      'False marks the dish sold out for the rest of the local day; true puts it back on the menu.',
  })
  @IsBoolean()
  available!: boolean;
}
