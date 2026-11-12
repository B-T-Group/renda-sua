import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AcceptAndStartRentalDto {
  @ApiProperty({ format: 'uuid', description: 'Current pickup inspection version the renter reviewed' })
  @IsUUID()
  versionId!: string;
}
