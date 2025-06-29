import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HasuraModule } from '../hasura/hasura.module';
import { UsersModule } from '../users/users.module';
import { AccountsModule } from '../accounts/accounts.module';
import { OrdersModule } from '../orders/orders.module';
import { AgentsModule } from '../agents/agents.module';
import { AwsModule } from '../aws/aws.module';
import { AccountsController } from '../accounts/accounts.controller';
import configuration from '../config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: [
        '.env.local',
        '.env.development',
        '.env.production',
        '.env',
      ],
      cache: true,
      expandVariables: true,
    }),
    HasuraModule,
    UsersModule,
    AccountsModule,
    OrdersModule,
    AgentsModule,
    AwsModule,
  ],
  controllers: [AppController, AccountsController],
  providers: [AppService],
})
export class AppModule {}
