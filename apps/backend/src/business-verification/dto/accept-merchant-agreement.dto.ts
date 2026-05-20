import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AcceptMerchantAgreementDto {
  @ApiProperty({ description: 'Full legal name of the signatory' })
  @IsString()
  @IsNotEmpty()
  legalName!: string;

  @ApiProperty({ description: 'Agreement version being accepted' })
  @IsString()
  @IsNotEmpty()
  agreementVersion!: string;

  @ApiProperty({
    description: 'Optional PNG signature as base64 (data URL or raw)',
    required: false,
  })
  @IsString()
  @IsOptional()
  signatureBase64?: string;
}
