import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReelAiReviewFeedbackDto {
  @ApiProperty({ enum: ['agree', 'disagree'] })
  @IsIn(['agree', 'disagree'])
  feedback!: 'agree' | 'disagree';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class ReelAiReviewOverrideDto {
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
