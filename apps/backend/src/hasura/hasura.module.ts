import { Module } from '@nestjs/common';
import { HasuraSystemService } from './hasura-system.service';
import { HasuraUserService } from './hasura-user.service';
import { HasuraController } from './hasura.controller';

@Module({
  controllers: [HasuraController],
  providers: [HasuraSystemService, HasuraUserService],
  exports: [HasuraSystemService, HasuraUserService],
})
export class HasuraModule {} 