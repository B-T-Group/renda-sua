import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { AccountsController } from '../accounts/accounts.controller';
import { AccountsModule } from '../accounts/accounts.module';
import { AddressesModule } from '../addresses/addresses.module';
import { AdminModule } from '../admin/admin.module';
import { AgentsModule } from '../agents/agents.module';
import { AirtelMoneyController } from '../airtel-money/airtel-money.controller';
import { AirtelMoneyModule } from '../airtel-money/airtel-money.module';
import { AuthModule } from '../auth/auth.module';
import { AwsModule } from '../aws/aws.module';
import configuration from '../config/configuration';
import { createWinstonConfig } from '../config/logging.config';
import { GoogleModule } from '../google/google.module';
import { HasuraModule } from '../hasura/hasura.module';
import { MtnMomoController } from '../mtn-momo/mtn-momo.controller';
import { MtnMomoModule } from '../mtn-momo/mtn-momo.module';
import { OrdersModule } from '../orders/orders.module';
import { ServicesModule } from '../services/services.module';
import { UploadsModule } from '../uploads/uploads.module';
import { UsersModule } from '../users/users.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
      load: [configuration],
      cache: true,
      expandVariables: true,
    }),
    WinstonModule.forRootAsync({
      useFactory: () => {
        return createWinstonConfig({
          logGroupName:
            process.env.CLOUDWATCH_LOG_GROUP || 'rendasua-backend-logs',
          logStreamName: process.env.CLOUDWATCH_LOG_STREAM || 'application',
          region: process.env.AWS_REGION || 'ca-central-1',
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
          logLevel: process.env.LOG_LEVEL || 'debug',
          enableCloudWatch: process.env.NODE_ENV === 'production',
          enableConsole: process.env.NODE_ENV !== 'production',
        });
      },
    }),
    AuthModule,
    HasuraModule,
    ServicesModule,
    UploadsModule,
    UsersModule,
    AccountsModule,
    AddressesModule,
    OrdersModule,
    AgentsModule,
    AwsModule,
    MtnMomoModule,
    AirtelMoneyModule,
    GoogleModule,
    AdminModule,
  ],
  controllers: [
    AppController,
    AccountsController,
    MtnMomoController,
    AirtelMoneyController,
  ],
  providers: [AppService],
})
export class AppModule {}
