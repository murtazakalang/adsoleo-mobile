import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    // Upsert device by fcmToken to avoid duplicates
    return this.prisma.device.upsert({
      where: { fcmToken: dto.fcmToken },
      update: { userId, platform: dto.platform },
      create: {
        userId,
        fcmToken: dto.fcmToken,
        platform: dto.platform,
      },
    });
  }

  async removeDevice(userId: string, id: string) {
    const device = await this.prisma.device.findFirst({
      where: { id, userId },
    });

    if (!device) {
      throw new NotFoundException('Device not found or not owned by user');
    }

    return this.prisma.device.delete({
      where: { id },
    });
  }
}
