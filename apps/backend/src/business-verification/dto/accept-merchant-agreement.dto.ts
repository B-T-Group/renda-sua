import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class MerchantAgreementDeviceInfoDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  platform?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  osName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  osVersion?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  modelName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  appVersion?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  brand?: string;
}

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

  @ApiProperty({
    description: 'Optional client device metadata for the audit trail',
    required: false,
    type: MerchantAgreementDeviceInfoDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => MerchantAgreementDeviceInfoDto)
  deviceInfo?: MerchantAgreementDeviceInfoDto;
}
