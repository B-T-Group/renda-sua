import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AcceptAiProposalDto {
  @ApiPropertyOptional({
    description:
      'Apply the suggested title (or the provided title override). Set to false to keep the current title. Defaults to true.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  applyTitle?: boolean;

  @ApiPropertyOptional({
    description:
      'Apply the suggested description (or the provided description override). Set to false to keep the current description. Defaults to true.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  applyDescription?: boolean;

  @ApiPropertyOptional({
    description:
      'Title to apply instead of the AI-proposed title. Ignored when applyTitle is false.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    description:
      'Description to apply instead of the AI-proposed description. Ignored when applyDescription is false.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  description?: string;
}

export class AiReviewFeedbackDto {
  @ApiProperty({ enum: ['agree', 'disagree'] })
  @IsIn(['agree', 'disagree'])
  feedback!: 'agree' | 'disagree';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class AiReviewOverrideDto {
  @ApiProperty({
    enum: ['force_approve', 'force_reject', 'force_requeue'],
  })
  @IsIn(['force_approve', 'force_reject', 'force_requeue'])
  action!: 'force_approve' | 'force_reject' | 'force_requeue';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  reason?: string;
}
