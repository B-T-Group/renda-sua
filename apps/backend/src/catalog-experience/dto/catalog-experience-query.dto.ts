import { IsIn, IsOptional, IsString } from 'class-validator';

export class CatalogExperienceQueryDto {
  @IsOptional()
  @IsString()
  country_code?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsIn(['discovery', 'results'])
  layout?: 'discovery' | 'results';

  @IsOptional()
  @IsString()
  device?: string;
}
