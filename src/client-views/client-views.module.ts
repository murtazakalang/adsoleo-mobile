import { Module } from '@nestjs/common';
import { ClientViewsService } from './client-views.service';
import { ClientViewsController } from './client-views.controller';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [EmailModule, NotificationsModule],
  controllers: [ClientViewsController],
  providers: [ClientViewsService],
})
export class ClientViewsModule {}
