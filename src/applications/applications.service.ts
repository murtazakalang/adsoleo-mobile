import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApplicationStatus, ProjectStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import {
  NotificationEvent,
  NotificationsService,
} from '../notifications/notifications.service';

const ALLOWED_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  [ApplicationStatus.PENDING]: [
    ApplicationStatus.SELECTED,
    ApplicationStatus.REJECTED,
  ],
  [ApplicationStatus.SELECTED]: [
    ApplicationStatus.SENT_TO_CLIENT,
    ApplicationStatus.REJECTED,
  ],
  [ApplicationStatus.REJECTED]: [],
  [ApplicationStatus.SENT_TO_CLIENT]: [
    ApplicationStatus.CLIENT_APPROVED,
    ApplicationStatus.CLIENT_REJECTED,
  ],
  [ApplicationStatus.CLIENT_APPROVED]: [],
  [ApplicationStatus.CLIENT_REJECTED]: [],
};

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(creatorId: string, dto: CreateApplicationDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.status !== ProjectStatus.ACTIVE) {
      throw new BadRequestException('You can only apply to active projects');
    }

    const existing = await this.prisma.application.findUnique({
      where: {
        projectId_creatorId: {
          projectId: dto.projectId,
          creatorId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        'You have already applied to this project',
      );
    }

    const application = await this.prisma.application.create({
      data: {
        creatorId,
        projectId: dto.projectId,
        message: dto.message,
        contentIdea: dto.contentIdea,
        availability: dto.availability,
        status: ApplicationStatus.PENDING,
      },
    });

    // Notify admins that a new application has come in
    void this.notifications.dispatch(NotificationEvent.NEW_APPLICATION, {
      title: 'New application',
      body: `A creator applied to "${project.title}"`,
      data: { projectId: project.id, applicationId: application.id },
    });

    return application;
  }

  findByCreator(creatorId: string) {
    return this.prisma.application.findMany({
      where: { creatorId },
      include: {
        project: {
          select: { title: true, status: true, platform: true, deadline: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.application.findMany({
      where: { projectId },
      include: {
        creator: { include: { profile: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(applicationId: string, dto: UpdateStatusDto) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { project: true },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }

    this.assertTransitionAllowed(application.status, dto.status);

    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data: { status: dto.status },
    });

    // Fire CREATOR_SELECTED when an admin moves an app into SELECTED
    if (
      application.status !== ApplicationStatus.SELECTED &&
      updated.status === ApplicationStatus.SELECTED
    ) {
      void this.notifications.dispatch(NotificationEvent.CREATOR_SELECTED, {
        userId: application.creatorId,
        title: 'You were selected',
        body: `You were shortlisted for "${application.project.title}".`,
        data: {
          projectId: application.projectId,
          applicationId: application.id,
        },
      });
    }

    return updated;
  }

  private assertTransitionAllowed(
    from: ApplicationStatus,
    to: ApplicationStatus,
  ) {
    if (from === to) return;
    const allowed = ALLOWED_TRANSITIONS[from];
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `Illegal status transition: ${from} → ${to}`,
      );
    }
  }
}
