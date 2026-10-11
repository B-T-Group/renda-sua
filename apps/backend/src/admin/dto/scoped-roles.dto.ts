import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
} from 'class-validator';

export class ScopedRoleGrantDto {
  @IsString()
  role!: string;

  @IsString()
  @Length(2, 2)
  countryCode!: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  stateIds?: string[];
}

export class SetScopedRolesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScopedRoleGrantDto)
  grants!: ScopedRoleGrantDto[];
}

export class LookupUserQueryDto {
  @IsEmail()
  email!: string;
}
