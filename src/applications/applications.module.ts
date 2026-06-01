import { Module } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { ApplicationsController } from './applications.controller';
import { ProjectApplicationsController } from './project-applications.controller';
import { CreatorsModule } from '../creators/creators.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [CreatorsModule, NotificationsModule],
  controllers: [ApplicationsController, ProjectApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
