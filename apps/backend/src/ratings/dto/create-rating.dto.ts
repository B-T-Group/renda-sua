import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export enum RatingType {
  CLIENT_TO_AGENT = 'client_to_agent',
  CLIENT_TO_ITEM = 'client_to_item',
  AGENT_TO_CLIENT = 'agent_to_client',
  CLIENT_TO_RENTAL_ITEM = 'client_to_rental_item',
  CLIENT_TO_RENTAL_BUSINESS = 'client_to_rental_business',
}

export enum RatedEntityType {
  AGENT = 'agent',
  CLIENT = 'client',
  ITEM = 'item',
  RENTAL_ITEM = 'rental_item',
  BUSINESS = 'business',
}

export class CreateRatingDto {
  @ValidateIf((o: CreateRatingDto) => !o.rentalBookingId)
  @IsUUID()
  orderId?: string;

  @ValidateIf((o: CreateRatingDto) => !o.orderId)
  @IsUUID()
  rentalBookingId?: string;

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
