import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AcceptAiProposalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
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
