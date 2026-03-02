import { IsUUID } from 'class-validator';

export class TrackItemViewDto {
  @IsUUID()
  itemId!: string;
}

