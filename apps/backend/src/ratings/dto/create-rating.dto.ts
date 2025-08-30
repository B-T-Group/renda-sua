import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export enum RatingType {
  CLIENT_TO_AGENT = 'client_to_agent',
  CLIENT_TO_ITEM = 'client_to_item',
  AGENT_TO_CLIENT = 'agent_to_client',
}

export enum RatedEntityType {
  AGENT = 'agent',
  CLIENT = 'client',
  ITEM = 'item',
}

export class CreateRatingDto {
  @IsUUID()
  orderId!: string;

  @IsEnum(RatingType)
  ratingType!: RatingType;

  @IsEnum(RatedEntityType)
  ratedEntityType!: RatedEntityType;

  @IsUUID()
  ratedEntityId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  isPublic?: boolean;
}
