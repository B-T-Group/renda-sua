import { Module } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [HasuraModule],
  controllers: [SupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
