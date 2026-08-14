import { ApiProperty } from '@nestjs/swagger';

export class PatchRoleDto {
  @ApiProperty({ format: 'uuid' })
  role_id!: string;
}
