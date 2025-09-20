import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class UpdateConfigurationDto {
  @ApiProperty({
    description: 'Configuration name',
    example: 'Base Delivery Fee',
    required: false,
  })
  @IsString()
  @IsOptional()
  config_name?: string;

  @ApiProperty({
    description: 'Configuration description',
    example: 'Base fee charged for delivery regardless of distance',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Data type of the configuration value',
    enum: ['string', 'number', 'boolean', 'json', 'array', 'date', 'currency'],
    example: 'number',
    required: false,
  })
  @IsString()
  @IsIn(['string', 'number', 'boolean', 'json', 'array', 'date', 'currency'])
  @IsOptional()
  data_type?: string;

  @ApiProperty({
    description: 'String value (for string/currency types)',
    example: 'XAF',
    required: false,
  })
  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.data_type === 'string' || o.data_type === 'currency')
  string_value?: string;

  @ApiProperty({
    description: 'Number value (for number/currency types)',
    example: 1500.5,
    required: false,
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsOptional()
  @ValidateIf((o) => o.data_type === 'number' || o.data_type === 'currency')
  number_value?: number;

  @ApiProperty({
    description: 'Boolean value (for boolean type)',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  @ValidateIf((o) => o.data_type === 'boolean')
  boolean_value?: boolean;

  @ApiProperty({
    description: 'JSON value (for json type)',
    example: { base_fee: 300, per_km_rate: 50 },
    required: false,
  })
  @IsOptional()
  @ValidateIf((o) => o.data_type === 'json')
  json_value?: any;

  @ApiProperty({
    description: 'Array value (for array type)',
    example: ['XAF', 'USD', 'EUR'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @ValidateIf((o) => o.data_type === 'array')
  array_value?: string[];

  @ApiProperty({
    description: 'Date value (for date type)',
    example: '2024-01-15T10:30:00Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  @ValidateIf((o) => o.data_type === 'date')
  date_value?: string;

  @ApiProperty({
    description: 'Country code (ISO 3166-1 alpha-2)',
    example: 'CM',
    required: false,
  })
  @IsString()
  @IsOptional()
  country_code?: string;

  @ApiProperty({
    description: 'Configuration status',
    enum: ['active', 'inactive', 'deprecated'],
    example: 'active',
    required: false,
  })
  @IsString()
  @IsIn(['active', 'inactive', 'deprecated'])
  @IsOptional()
  status?: string;

  @ApiProperty({
    description: 'Configuration tags for categorization',
    example: ['delivery', 'pricing'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty({
    description: 'Validation rules as JSON',
    example: { required: true, min: 0, max: 100 },
    required: false,
  })
  @IsOptional()
  validation_rules?: any;

  @ApiProperty({
    description: 'Minimum value for numeric validations',
    example: 0,
    required: false,
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsOptional()
  min_value?: number;

  @ApiProperty({
    description: 'Maximum value for numeric validations',
    example: 100000,
    required: false,
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsOptional()
  max_value?: number;

  @ApiProperty({
    description: 'Allowed values for enum-like validations',
    example: ['active', 'inactive', 'deprecated'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowed_values?: string[];

  @ApiProperty({
    description: 'User ID who updated this configuration',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  updated_by?: string;
}
