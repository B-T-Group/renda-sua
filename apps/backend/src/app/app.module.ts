import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HasuraModule } from '../hasura/hasura.module';

@Module({
  imports: [HasuraModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
