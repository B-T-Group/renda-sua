import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const MAX_SLOTS_PER_WEEK = 42;

export class FoodAvailabilitySlotDto {
  @ApiProperty({
    description: 'Day of week, 0 = Sunday through 6 = Saturday',
    minimum: 0,
    maximum: 6,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  day_of_week!: number;

  @ApiProperty({ description: 'Window start as HH:mm or HH:mm:ss', example: '12:30' })
  @Matches(TIME_OF_DAY_PATTERN, {
    message: 'start_time must be HH:mm or HH:mm:ss',
  })
  start_time!: string;

  @ApiProperty({
    description:
      'Window end as HH:mm or HH:mm:ss. Earlier than start_time means the window runs past midnight.',
    example: '16:00',
  })
  @Matches(TIME_OF_DAY_PATTERN, {
    message: 'end_time must be HH:mm or HH:mm:ss',
  })
  end_time!: string;
}

export class UpdateFoodSettingsDto {
  @ApiProperty({
    description:
      'Complete weekly schedule for this dish at this location. An empty array clears the schedule, making the dish available at all times.',
    type: [FoodAvailabilitySlotDto],
  })
  @IsArray()
  @ArrayMaxSize(MAX_SLOTS_PER_WEEK)
  @ValidateNested({ each: true })
  @Type(() => FoodAvailabilitySlotDto)
  slots!: FoodAvailabilitySlotDto[];
}
