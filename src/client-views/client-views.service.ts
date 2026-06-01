import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { ApplicationStatus, DecisionType } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { SendToClientDto } from './dto/send-to-client.dto';
import { ClientViewDecisionDto } from './dto/client-view-decision.dto';
import {
  NotificationEvent,
  NotificationsService,
} from '../notifications/notifications.service';

@Injectable()
export class ClientViewsService {
  private readonly logger = new Logger(ClientViewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly notifications: NotificationsService,
  ) {}

  async sendToClient(
    projectId: string,
    adminId: string,
    dto: SendToClientDto,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');

    const applications = await this.prisma.application.findMany({
      where: { id: { in: dto.applicationIds } },
      select: { id: true, projectId: true, status: true },
    });

    if (applications.length !== dto.applicationIds.length) {
      throw new BadRequestException('One or more applications were not found');
    }

    for (const app of applications) {
      if (app.projectId !== projectId) {
        throw new BadRequestException(
          `Application ${app.id} does not belong to project ${projectId}`,
        );
      }
      if (app.status !== ApplicationStatus.SELECTED) {
        throw new BadRequestException(
          `Application ${app.id} is not in SELECTED state (current: ${app.status})`,
        );
      }
    }

    const rawToken = crypto.randomBytes(32).toString('base64url');
    const hashedToken = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + dto.expiresInDays);

    const { clientView } = await this.prisma.$transaction(async (tx) => {
      const view = await tx.clientView.create({
        data: {
          projectId,
          token: hashedToken,
          clientEmail: dto.clientEmail,
          expiresAt,
          createdById: adminId,
          creators: {
            create: dto.applicationIds.map((appId) => ({
              applicationId: appId,
            })),
          },
        },
      });

      await tx.application.updateMany({
        where: { id: { in: dto.applicationIds } },
        data: { status: ApplicationStatus.SENT_TO_CLIENT },
      });

      return { clientView: view };
    });

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const magicLink = `${baseUrl}/client-view/${rawToken}`;

    await this.emailService.sendEmail({
      to: dto.clientEmail,
      templateId: 'd-mock-template-id',
      dynamicTemplateData: {
        magicLink,
        projectTitle: project.title,
        expiresInDays: dto.expiresInDays,
      },
    });

    this.logger.log(`Generated Client View magic link: ${magicLink}`);

    return { success: true, message: 'Sent successfully', id: clientView.id };
  }

  getProjectClientViews(projectId: string) {
    return this.prisma.clientView.findMany({
      where: { projectId },
      include: {
        _count: { select: { creators: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deactivate(id: string) {
    const view = await this.prisma.clientView.findUnique({ where: { id } });
    if (!view) throw new NotFoundException('Client view not found');

    return this.prisma.clientView.update({
      where: { id },
      data: { deactivatedAt: new Date() },
    });
  }

  async getShortlistByToken(rawToken: string) {
    const hashedToken = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const view = await this.prisma.clientView.findUnique({
      where: { token: hashedToken },
      include: {
        project: true,
        creators: {
          include: {
            application: {
              include: {
                creator: {
                  include: {
                    profile: {
                      include: {
                        media: {
                          orderBy: { orderIndex: 'asc' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!view) {
      throw new NotFoundException({ status: 'not_found', message: 'Link not found' });
    }

    if (view.deactivatedAt) {
      throw new ForbiddenException({ status: 'deactivated', message: 'Link deactivated' });
    }

    if (view.expiresAt < new Date()) {
      throw new ForbiddenException({ status: 'expired', message: 'Link expired' });
    }

    // Map output to remove sensitive info
    return {
      project: view.project,
      creators: view.creators.map((c) => {
        const app = c.application;
        const profile = app.creator.profile;
        return {
          applicationId: app.id,
          message: app.message,
          contentIdea: app.contentIdea,
          availability: app.availability,
          profile: {
            publicName: profile?.publicName,
            photoUrl: profile?.photoUrl,
            bio: profile?.bio,
            country: profile?.country,
            city: profile?.city,
            categories: profile?.categories,
            subCategories: profile?.subCategories,
            languages: profile?.languages,
            contentStyles: profile?.contentStyles,
            tiktokUsername: profile?.tiktokUsername,
            tiktokUrl: profile?.tiktokUrl,
            tiktokFollowers: profile?.tiktokFollowers,
            instagramUsername: profile?.instagramUsername,
            instagramUrl: profile?.instagramUrl,
            instagramFollowers: profile?.instagramFollowers,
            engagementRate: profile?.engagementRate,
            media: profile?.media.map(m => ({
              id: m.id,
              type: m.type,
              mimeType: m.mimeType,
              // Usually we would provide a CDN URL, since media is stored as bytes, we can omit or provide an endpoint. 
              // Assuming /api/v1/creators/media/:id serves it
              url: `/api/v1/creators/media/${m.id}`
            }))
          },
        };
      }),
    };
  }

  async submitDecision(rawToken: string, dto: ClientViewDecisionDto) {
    const hashedToken = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const view = await this.prisma.clientView.findUnique({
      where: { token: hashedToken },
      include: {
        creators: true,
      },
    });

    if (!view) throw new NotFoundException('Link not found');
    if (view.deactivatedAt) throw new ForbiddenException('Link deactivated');
    if (view.expiresAt < new Date()) throw new ForbiddenException('Link expired');

    // Check if application is in this view
    const isAppInView = view.creators.some(c => c.applicationId === dto.applicationId);
    if (!isAppInView) {
      throw new BadRequestException('Application not in this shortlist');
    }

    // Check idempotency (only one APPROVED/REJECTED decision per application per view)
    if (dto.decision !== DecisionType.COMMENT_ONLY) {
      const existingDecision = await this.prisma.clientFeedback.findFirst({
        where: {
          clientViewId: view.id,
          applicationId: dto.applicationId,
          decision: { not: DecisionType.COMMENT_ONLY },
        },
      });

      if (existingDecision) {
        if (existingDecision.decision === dto.decision) {
          // Idempotent: same decision exists
          return { success: true, message: 'Decision already recorded' };
        } else {
          // Cannot change decision
          throw new BadRequestException('A decision has already been made for this creator');
        }
      }
    }

    await this.prisma.clientFeedback.create({
      data: {
        clientViewId: view.id,
        applicationId: dto.applicationId,
        decision: dto.decision,
        comment: dto.comment,
      },
    });

    // Resolve the creator user id + project title so notifications carry useful context.
    const application = await this.prisma.application.findUnique({
      where: { id: dto.applicationId },
      include: { project: { select: { title: true } } },
    });

    const projectTitle = application?.project.title ?? 'a project';
    const eventByDecision: Record<DecisionType, NotificationEvent> = {
      [DecisionType.APPROVED]: NotificationEvent.CLIENT_APPROVED,
      [DecisionType.REJECTED]: NotificationEvent.CLIENT_REJECTED,
      [DecisionType.COMMENT_ONLY]: NotificationEvent.CLIENT_COMMENT,
    };
    const event = eventByDecision[dto.decision];

    // Admins always get notified (broadcast by event)
    void this.notifications.dispatch(event, {
      title: `Client ${dto.decision.toLowerCase().replace('_', ' ')}`,
      body: `A client decision came in on "${projectTitle}".`,
      data: {
        applicationId: dto.applicationId,
        decision: dto.decision,
      },
    });

    // Creator gets a targeted notification on APPROVED (push+SMS) or REJECTED/COMMENT (in-app)
    if (application?.creatorId) {
      void this.notifications.dispatch(event, {
        userId: application.creatorId,
        title:
          dto.decision === DecisionType.APPROVED
            ? "You're approved by the client"
            : dto.decision === DecisionType.REJECTED
              ? 'Client passed on your application'
              : 'Client left a comment',
        body: `Update on "${projectTitle}".`,
        data: {
          applicationId: dto.applicationId,
          decision: dto.decision,
        },
      });
    }

    return { success: true, message: 'Decision submitted successfully' };
  }
}
