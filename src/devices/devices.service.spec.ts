import { NotFoundException } from '@nestjs/common';
import { DevicesService } from './devices.service';

function makePrisma() {
  return {
    device: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
  };
}

describe('DevicesService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: DevicesService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new DevicesService(prisma as never);
  });

  it('upserts on fcmToken to avoid duplicates per token', async () => {
    prisma.device.upsert.mockResolvedValue({ id: 'd1' });
    await service.registerDevice('u1', { fcmToken: 'tok', platform: 'ios' });
    expect(prisma.device.upsert).toHaveBeenCalledWith({
      where: { fcmToken: 'tok' },
      update: { userId: 'u1', platform: 'ios' },
      create: { userId: 'u1', fcmToken: 'tok', platform: 'ios' },
    });
  });

  it('throws when removing a device the user does not own', async () => {
    prisma.device.findFirst.mockResolvedValue(null);
    await expect(service.removeDevice('u1', 'd1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deletes when ownership matches', async () => {
    prisma.device.findFirst.mockResolvedValue({ id: 'd1' });
    await service.removeDevice('u1', 'd1');
    expect(prisma.device.delete).toHaveBeenCalledWith({ where: { id: 'd1' } });
  });
});
