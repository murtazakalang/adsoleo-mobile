import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { EmailService } from '../email/email.service';

export enum NotificationEvent {
  NEW_PROJECT = 'NEW_PROJECT',
  NEW_APPLICATION = 'NEW_APPLICATION',
  CREATOR_SELECTED = 'CREATOR_SELECTED',
  CLIENT_APPROVED = 'CLIENT_APPROVED',
  CLIENT_REJECTED = 'CLIENT_REJECTED',
  CLIENT_COMMENT = 'CLIENT_COMMENT',
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private initialized = false;

  constructor(
    private prisma: PrismaService,
    private sms: SmsService,
    private email: EmailService,
  ) {
    try {
      // Expects GOOGLE_APPLICATION_CREDENTIALS in env to initialize automatically
      // or explicit initialization if needed
      if (!admin.apps.length) {
        admin.initializeApp();
      }
      this.initialized = true;
    } catch (e) {
      this.logger.warn(
        'Firebase Admin SDK failed to initialize. Push notifications disabled.',
      );
    }
  }

  async sendPushNotification(
    tokens: string[],
    title: string,
    body: string,
    data?: any,
  ) {
    if (!this.initialized || tokens.length === 0) return;

    const message: admin.messaging.MulticastMessage = {
      notification: { title, body },
      data: data || {},
      tokens,
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      this.logger.log(
        `Push notifications sent: ${response.successCount} success, ${response.failureCount} failed`,
      );
    } catch (error) {
      this.logger.error('Error sending push notifications:', error);
    }
  }

  async getNotifications(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(userId: string, id: string) {
    const notif = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notif) throw new NotFoundException('Notification not found');

    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async dispatch(
    event: NotificationEvent,
    payload: {
      userId?: string; // Optional if targeting specific user
      title: string;
      body: string;
      data?: any;
    },
  ) {
    // Determine target users based on event
    let targetUsers: {
      id: string;
      role: string;
      phone: string | null;
    }[] = [];

    if (payload.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
      });
      if (user) {
        targetUsers.push({ id: user.id, role: user.role, phone: user.phone });
      }
    } else {
      // Broadcast logic based on event
      if (event === NotificationEvent.NEW_PROJECT) {
        const creators = await this.prisma.user.findMany({
          where: { role: 'CREATOR' },
        });
        targetUsers = creators.map((c) => ({
          id: c.id,
          role: c.role,
          phone: c.phone,
        }));
      } else if (
        event === NotificationEvent.NEW_APPLICATION ||
        event === NotificationEvent.CLIENT_APPROVED ||
        event === NotificationEvent.CLIENT_REJECTED ||
        event === NotificationEvent.CLIENT_COMMENT
      ) {
        const admins = await this.prisma.user.findMany({
          where: { role: 'ADMIN' },
        });
        targetUsers = admins.map((a) => ({
          id: a.id,
          role: a.role,
          phone: a.phone,
        }));
      }
    }

    if (targetUsers.length === 0) return;

    // Rules from PRD §5.7
    // Push + SMS for Creator selected / Client approved for Creators
    const sendPush = [
      NotificationEvent.NEW_PROJECT,
      NotificationEvent.CREATOR_SELECTED,
      NotificationEvent.CLIENT_APPROVED,
    ].includes(event);

    const sendSms = [
      NotificationEvent.CREATOR_SELECTED,
      NotificationEvent.CLIENT_APPROVED,
    ].includes(event);

    const inAppRoles = {
      [NotificationEvent.NEW_APPLICATION]: ['ADMIN'],
      [NotificationEvent.CLIENT_APPROVED]: ['ADMIN'], // Push+SMS to creator, In-App to Admin
      [NotificationEvent.CLIENT_REJECTED]: ['ADMIN', 'CREATOR'],
      [NotificationEvent.CLIENT_COMMENT]: ['ADMIN', 'CREATOR'],
    };

    // Prepare arrays
    const inAppToCreate: {
      userId: string;
      type: string;
      title: string;
      body: string;
      payload: any;
    }[] = [];
    const pushUserIds: string[] = [];
    const smsNumbers: string[] = [];

    for (const u of targetUsers) {
      // Check In-App
      const rolesForInApp = inAppRoles[event];
      if (rolesForInApp && rolesForInApp.includes(u.role)) {
        inAppToCreate.push({
          userId: u.id,
          type: event,
          title: payload.title,
          body: payload.body,
          payload: payload.data || {},
        });
      }

      // Check Push
      if (sendPush && u.role === 'CREATOR') {
        pushUserIds.push(u.id);
      }

      // Check SMS
      if (sendSms && u.role === 'CREATOR' && u.phone) {
        smsNumbers.push(u.phone);
      }
    }

    // 1. Create In-App
    if (inAppToCreate.length > 0) {
      await this.prisma.notification.createMany({ data: inAppToCreate });
    }

    // 2. Send Push
    if (pushUserIds.length > 0) {
      const devices = await this.prisma.device.findMany({
        where: { userId: { in: pushUserIds } },
      });
      const tokens = devices.map((d) => d.fcmToken).filter(Boolean);
      if (tokens.length > 0) {
        await this.sendPushNotification(tokens, payload.title, payload.body, payload.data);
      }
    }

    // 3. Send SMS
    if (smsNumbers.length > 0) {
      for (const number of smsNumbers) {
        await this.sms.sendSms(number, `${payload.title}: ${payload.body}`);
      }
    }
  }
}
