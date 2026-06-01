import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { StorageModule } from './storage/storage.module';
import { EmailModule } from './email/email.module';
import { SmsModule } from './sms/sms.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CreatorsModule } from './creators/creators.module';
import { ProjectsModule } from './projects/projects.module';
import { ApplicationsModule } from './applications/applications.module';
import { ClientViewsModule } from './client-views/client-views.module';
import { DevicesModule } from './devices/devices.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ScheduleModule } from '@nestjs/schedule';

import { HealthController } from './health.controller';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty' }
            : undefined,
      },
    }),
    PrismaModule,
    AuthModule,
    StorageModule,
    EmailModule,
    SmsModule,
    NotificationsModule,
    CreatorsModule,
    ProjectsModule,
    ApplicationsModule,
    ClientViewsModule,
    DevicesModule,
    AnalyticsModule,
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      exclude: ['/api/(.*)'],
    }),
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
