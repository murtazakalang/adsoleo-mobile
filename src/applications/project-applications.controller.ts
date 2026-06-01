import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ApplicationsService } from './applications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('applications')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Controller('projects/:projectId/applications')
export class ProjectApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List applications for a project (Admin only)' })
  list(@Param('projectId') projectId: string) {
    return this.applicationsService.findByProject(projectId);
  }
}
