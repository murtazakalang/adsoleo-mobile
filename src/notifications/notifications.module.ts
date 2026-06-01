import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { ReminderCron } from './reminder.cron';
import { PrismaModule } from '../prisma/prisma.module';
import { SmsModule } from '../sms/sms.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, SmsModule, EmailModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, ReminderCron],
  exports: [NotificationsService],
})
export class NotificationsModule {}
