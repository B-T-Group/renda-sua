import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
