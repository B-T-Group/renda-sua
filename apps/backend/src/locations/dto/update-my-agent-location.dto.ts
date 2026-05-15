import { IsLatitude, IsLongitude } from 'class-validator';

export class UpdateMyAgentLocationDto {
  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;
}
