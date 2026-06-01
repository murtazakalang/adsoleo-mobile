import { NotFoundException } from '@nestjs/common';
import {
  NotificationEvent,
  NotificationsService,
} from './notifications.service';

type PrismaMock = {
  user: { findUnique: jest.Mock; findMany: jest.Mock };
  notification: {
    createMany: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
  };
  device: { findMany: jest.Mock };
};

function makePrisma(): PrismaMock {
  return {
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    notification: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    device: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

describe('NotificationsService', () => {
  let prisma: PrismaMock;
  let sms: { sendSms: jest.Mock };
  let email: { sendEmail: jest.Mock };
  let service: NotificationsService;

  beforeEach(() => {
    prisma = makePrisma();
    sms = { sendSms: jest.fn().mockResolvedValue(undefined) };
    email = { sendEmail: jest.fn().mockResolvedValue(undefined) };
    service = new NotificationsService(
      prisma as never,
      sms as never,
      email as never,
    );
  });

  describe('markAsRead', () => {
    it('throws when the notification does not belong to the caller', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);
      await expect(service.markAsRead('u1', 'n1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('updates readAt when ownership matches', async () => {
      prisma.notification.findFirst.mockResolvedValue({ id: 'n1' });
      prisma.notification.update.mockResolvedValue({ id: 'n1' });
      await service.markAsRead('u1', 'n1');
      expect(prisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'n1' },
          data: expect.objectContaining({ readAt: expect.any(Date) }),
        }),
      );
    });
  });

  describe('dispatch', () => {
    it('creates an admin in-app row for NEW_APPLICATION', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'admin1', role: 'ADMIN', phone: null },
      ]);
      await service.dispatch(NotificationEvent.NEW_APPLICATION, {
        title: 'New app',
        body: 'hi',
      });
      expect(prisma.notification.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            userId: 'admin1',
            type: NotificationEvent.NEW_APPLICATION,
          }),
        ],
      });
    });

    it('queries device tokens for CREATOR_SELECTED targeted user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'creator1',
        role: 'CREATOR',
        phone: '+15555555555',
      });
      prisma.device.findMany.mockResolvedValue([
        { fcmToken: 'tok-1' },
        { fcmToken: 'tok-2' },
      ]);
      await service.dispatch(NotificationEvent.CREATOR_SELECTED, {
        userId: 'creator1',
        title: 'Selected',
        body: 'pick',
      });
      expect(prisma.device.findMany).toHaveBeenCalledWith({
        where: { userId: { in: ['creator1'] } },
      });
      expect(sms.sendSms).toHaveBeenCalledWith(
        '+15555555555',
        expect.stringContaining('Selected'),
      );
    });

    it('skips SMS when creator has no phone', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'creator1',
        role: 'CREATOR',
        phone: null,
      });
      await service.dispatch(NotificationEvent.CREATOR_SELECTED, {
        userId: 'creator1',
        title: 'Selected',
        body: 'pick',
      });
      expect(sms.sendSms).not.toHaveBeenCalled();
    });
  });
});
