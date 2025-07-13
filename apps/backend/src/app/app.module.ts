import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { AccountsController } from '../accounts/accounts.controller';
import { AccountsModule } from '../accounts/accounts.module';
import { AddressesModule } from '../addresses/addresses.module';
import { AgentsModule } from '../agents/agents.module';
import { AwsModule } from '../aws/aws.module';
import configuration from '../config/configuration';
import { createWinstonConfig } from '../config/logging.config';
import { GoogleModule } from '../google/google.module';
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
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const awsConfig = configService.get('aws');
        const appConfig = configService.get('app');

        return createWinstonConfig({
          logGroupName: awsConfig.cloudWatchLogGroup,
          logStreamName: awsConfig.cloudWatchLogStream,
          region: awsConfig.region,
          accessKeyId: awsConfig.accessKeyId,
          secretAccessKey: awsConfig.secretAccessKey,
          logLevel: appConfig.logLevel,
          enableCloudWatch: appConfig.nodeEnv === 'production',
          enableConsole: appConfig.nodeEnv !== 'production',
        });
      },
      inject: [ConfigService],
    }),
    HasuraModule,
    UsersModule,
    AccountsModule,
    AddressesModule,
    OrdersModule,
    AgentsModule,
    AwsModule,
    MtnMomoModule,
    GoogleModule,
  ],
  controllers: [AppController, AccountsController, MtnMomoController],
  providers: [AppService],
})
export class AppModule {}
