import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectRentalListingDto {
  @ApiProperty({
    description: 'Reason shown to the business in messages and email',
    example: 'Photos do not meet quality guidelines.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  rejectionReason!: string;
}
