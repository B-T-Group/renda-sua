import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateReelDto {
  @ApiProperty({ enum: ['item', 'rental', 'business'] })
  @IsIn(['item', 'rental', 'business'])
  subjectType!: 'item' | 'rental' | 'business';

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  subjectId!: string;

  @ApiProperty({ minLength: 2, maxLength: 2 })
  @Length(2, 2)
  marketCountry!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2200)
  caption?: string;
}

export class UpdateReelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2200)
  caption?: string;
}

export class SetReelActiveDto {
  @ApiProperty({ description: 'When false, the reel is hidden from the public feed' })
  @IsBoolean()
  isActive!: boolean;
}

export class ListMerchantReelsQueryDto {
  @ApiPropertyOptional({ enum: ['item', 'rental', 'business'] })
  @IsOptional()
  @IsIn(['item', 'rental', 'business'])
  subjectType?: 'item' | 'rental' | 'business';

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  subjectId?: string;
}

export class ReelUploadDto {
  @ApiProperty()
  @IsString()
  fileName!: string;

  @ApiProperty({ example: 'video/mp4' })
  @IsIn(['video/mp4', 'video/quicktime', 'video/webm'])
  contentType!: string;
}

export class ModerateReelDto {
  @ApiProperty({ enum: ['approved', 'rejected'] })
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';

  @ApiPropertyOptional({
    description: 'Required when rejecting a reel',
  })
  @ValidateIf((o: ModerateReelDto) => o.status === 'rejected')
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  reason?: string;
}
