import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HasuraModule } from '../hasura/hasura.module';
import { UsersModule } from '../users/users.module';
import { AccountsModule } from '../accounts/accounts.module';
import { OrdersModule } from '../orders/orders.module';
import { AgentsModule } from '../agents/agents.module';
import { AccountsController } from '../accounts/accounts.controller';

@Module({
  imports: [
    HasuraModule,
    UsersModule,
    AccountsModule,
    OrdersModule,
    AgentsModule,
  ],
  controllers: [AppController, AccountsController],
  providers: [AppService],
})
export class AppModule {}
