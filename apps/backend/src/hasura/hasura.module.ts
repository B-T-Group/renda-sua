import { Global, Module } from '@nestjs/common';
import { HasuraSystemService } from './hasura-system.service';
import { HasuraUserService } from './hasura-user.service';
import { HasuraController } from './hasura.controller';

@Global()
@Module({
  controllers: [HasuraController],
  providers: [HasuraSystemService, HasuraUserService],
  exports: [HasuraSystemService, HasuraUserService],
})
export class HasuraModule {} 