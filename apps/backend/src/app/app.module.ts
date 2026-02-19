import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { WinstonModule } from 'nest-winston';
import { AccountsController } from '../accounts/accounts.controller';
import { AccountsModule } from '../accounts/accounts.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AddressesModule } from '../addresses/addresses.module';
import { AdminModule } from '../admin/admin.module';
import { AgentsModule } from '../agents/agents.module';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { AwsModule } from '../aws/aws.module';
import { BrandsModule } from '../brands/brands.module';
import { BusinessItemsModule } from '../business-items/business-items.module';
import { CategoriesModule } from '../categories/categories.module';
import configuration from '../config/configuration';
import { createWinstonConfig } from '../config/logging.config';
import { DeliveryModule } from '../delivery/delivery.module';
import { GoogleModule } from '../google/google.module';
import { HasuraModule } from '../hasura/hasura.module';
import { InventoryItemsModule } from '../inventory-items/inventory-items.module';
import { LocationsModule } from '../locations/locations.module';
import { MobilePaymentsModule } from '../mobile-payments/mobile-payments.module';
import { MtnMomoController } from '../mtn-momo/mtn-momo.controller';
import { MtnMomoModule } from '../mtn-momo/mtn-momo.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import { RatingsModule } from '../ratings/ratings.module';
import { ServicesModule } from '../services/services.module';
import { SubcategoriesModule } from '../subcategories/subcategories.module';
import { SupportModule } from '../support/support.module';
import { UploadsModule } from '../uploads/uploads.module';
import { UsersModule } from '../users/users.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      cache: true,
      expandVariables: true,
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000,
        limit: 100,
      },
    ]),
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
          enableCloudWatch: process.env.ENABLE_CLOUDWATCH === 'true',
          enableConsole: true,
        });
      },
    }),
    AnalyticsModule,
    AuthModule,
    HasuraModule,
    InventoryItemsModule,
    LocationsModule,
    ServicesModule,
    UploadsModule,
    UsersModule,
    AccountsModule,
    AddressesModule,
    OrdersModule,
    RatingsModule,
    AgentsModule,
    AwsModule,
    MtnMomoModule,
    MobilePaymentsModule,
    GoogleModule,
    AdminModule,
    NotificationsModule,
    BrandsModule,
    BusinessItemsModule,
    CategoriesModule,
    SubcategoriesModule,
    AiModule,
    DeliveryModule,
    SupportModule,
  ],
  controllers: [AppController, AccountsController, MtnMomoController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
