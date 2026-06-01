import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ProjectStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import {
  NotificationEvent,
  NotificationsService,
} from '../notifications/notifications.service';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(createProjectDto: CreateProjectDto, adminId: string) {
    const project = await this.prisma.project.create({
      data: {
        ...createProjectDto,
        deadline: new Date(createProjectDto.deadline),
        createdById: adminId,
      },
    });

    if (project.status === ProjectStatus.ACTIVE) {
      void this.notifyNewProject(project);
    }

    return project;
  }

  async findAll(userRole: string, status?: ProjectStatus, search?: string) {
    const where: any = {};

    if (userRole !== 'ADMIN') {
      where.status = ProjectStatus.ACTIVE;
    } else if (status) {
      where.status = status;
    }

    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }

    return this.prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { email: true } } },
    });
  }

  async findOne(id: string, userRole: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { createdBy: { select: { email: true } } },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (userRole !== 'ADMIN' && project.status !== ProjectStatus.ACTIVE) {
      throw new ForbiddenException('Access to this project is denied');
    }

    return project;
  }

  async update(id: string, updateProjectDto: UpdateProjectDto) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const updateData: any = { ...updateProjectDto };
    if (updateProjectDto.deadline) {
      updateData.deadline = new Date(updateProjectDto.deadline);
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: updateData,
    });

    // Notify creators only on DRAFT -> ACTIVE (going-live transition)
    if (
      project.status !== ProjectStatus.ACTIVE &&
      updated.status === ProjectStatus.ACTIVE
    ) {
      void this.notifyNewProject(updated);
    }

    return updated;
  }

  private notifyNewProject(project: { id: string; title: string }) {
    return this.notifications.dispatch(NotificationEvent.NEW_PROJECT, {
      title: 'New project available',
      body: `"${project.title}" is now open for applications.`,
      data: { projectId: project.id },
    });
  }
}
