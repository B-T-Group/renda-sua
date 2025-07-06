import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccountsController } from '../accounts/accounts.controller';
import { AccountsModule } from '../accounts/accounts.module';
import { AgentsModule } from '../agents/agents.module';
import { AwsModule } from '../aws/aws.module';
import configuration from '../config/configuration';
import { HasuraModule } from '../hasura/hasura.module';
import { MtnMomoController } from '../mtn-momo/mtn-momo.controller';
import { MtnMomoModule } from '../mtn-momo/mtn-momo.module';
import { OrdersModule } from '../orders/orders.module';
import { UsersModule } from '../users/users.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      load: [configuration],
      cache: true,
      expandVariables: true,
    }),
    HasuraModule,
    UsersModule,
    AccountsModule,
    OrdersModule,
    AgentsModule,
    AwsModule,
    MtnMomoModule,
  ],
  controllers: [AppController, AccountsController, MtnMomoController],
  providers: [AppService],
})
export class AppModule {}
