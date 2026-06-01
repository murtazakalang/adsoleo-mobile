import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { MediaType, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateCreatorDto } from './dto/create-creator.dto';

const MAX_MEDIA_ITEMS = 6;

@Injectable()
export class CreatorsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Admin: create a creator account ─────────────────────────────────────
  async createCreator(dto: CreateCreatorDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: 'CREATOR',
        profile: {
          create: {
            publicName: dto.publicName ?? null,
          },
        },
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        profile: { select: { publicName: true, profileCompleted: true } },
      },
    });

    return user;
  }

  // ── Admin: list all creators (paginated + optional search) ───────────────
  async listCreators(params: { page: number; limit: number; search?: string }) {
    const { page, limit, search } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      role: 'CREATOR',
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              {
                profile: {
                  publicName: { contains: search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          createdAt: true,
          lastLoginAt: true,
          profile: {
            select: {
              publicName: true,
              profileCompleted: true,
              country: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items,
    };
  }

  async getProfileByUserId(userId: string) {
    const profile = await this.prisma.creatorProfile.findUnique({
      where: { userId },
      include: {
        media: {
          select: {
            id: true,
            mimeType: true,
            type: true,
            orderIndex: true,
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Creator profile not found');
    }

    return profile;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: Prisma.CreatorProfileUpdateInput = { ...dto };

    const updated = await this.prisma.creatorProfile.update({
      where: { userId },
      data,
      include: { media: true },
    });

    const profileCompleted = this.deriveProfileCompleted(updated);
    if (profileCompleted !== updated.profileCompleted) {
      return this.prisma.creatorProfile.update({
        where: { userId },
        data: { profileCompleted },
      });
    }

    return updated;
  }

  async uploadMedia(userId: string, file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const profile = await this.prisma.creatorProfile.findUnique({
      where: { userId },
      include: { _count: { select: { media: true } } },
    });
    if (!profile) {
      throw new NotFoundException('Creator profile not found');
    }
    if (profile._count.media >= MAX_MEDIA_ITEMS) {
      throw new BadRequestException(
        `Maximum ${MAX_MEDIA_ITEMS} media items per profile`,
      );
    }

    const type: MediaType = file.mimetype.startsWith('video/')
      ? MediaType.VIDEO
      : MediaType.IMAGE;

    const created = await this.prisma.creatorMedia.create({
      data: {
        creatorId: profile.id,
        imageBytes: Buffer.from(file.buffer),
        mimeType: file.mimetype,
        type,
        orderIndex: profile._count.media,
      },
      select: {
        id: true,
        mimeType: true,
        type: true,
        orderIndex: true,
      },
    });

    await this.refreshProfileCompletedFlag(userId);

    return created;
  }

  async getMediaBytes(mediaId: string) {
    const media = await this.prisma.creatorMedia.findUnique({
      where: { id: mediaId },
      select: { imageBytes: true, mimeType: true },
    });

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    return media;
  }

  async isProfileCompleteForUser(userId: string): Promise<boolean> {
    const profile = await this.prisma.creatorProfile.findUnique({
      where: { userId },
      include: { _count: { select: { media: true } } },
    });
    if (!profile) return false;
    return this.deriveProfileCompleted({
      publicName: profile.publicName,
      bio: profile.bio,
      country: profile.country,
      categories: profile.categories,
      instagramUsername: profile.instagramUsername,
      tiktokUsername: profile.tiktokUsername,
      mediaCount: profile._count.media,
    });
  }

  private async refreshProfileCompletedFlag(userId: string) {
    const profile = await this.prisma.creatorProfile.findUnique({
      where: { userId },
      include: { _count: { select: { media: true } } },
    });
    if (!profile) return;
    const completed = this.deriveProfileCompleted({
      publicName: profile.publicName,
      bio: profile.bio,
      country: profile.country,
      categories: profile.categories,
      instagramUsername: profile.instagramUsername,
      tiktokUsername: profile.tiktokUsername,
      mediaCount: profile._count.media,
    });
    if (completed !== profile.profileCompleted) {
      await this.prisma.creatorProfile.update({
        where: { userId },
        data: { profileCompleted: completed },
      });
    }
  }

  private deriveProfileCompleted(input: {
    publicName: string | null;
    bio: string | null;
    country: string | null;
    categories?: string[] | null;
    instagramUsername?: string | null;
    tiktokUsername?: string | null;
    media?: unknown[];
    mediaCount?: number;
  }): boolean {
    const mediaCount =
      input.mediaCount ?? (Array.isArray(input.media) ? input.media.length : 0);
    const hasCategory =
      Array.isArray(input.categories) && input.categories.length > 0;
    const hasSocial = Boolean(input.instagramUsername || input.tiktokUsername);
    return Boolean(
      input.publicName &&
        input.bio &&
        input.country &&
        hasCategory &&
        hasSocial &&
        mediaCount > 0,
    );
  }
}
