import { Controller, Post, Get, Put, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequireCompleteProfileGuard } from '../auth/guards/require-complete-profile.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('applications')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  @UseGuards(RequireCompleteProfileGuard)
  @ApiOperation({ summary: 'Apply to a project (Creator only, requires complete profile)' })
  create(@Req() req: any, @Body() dto: CreateApplicationDto) {
    return this.applicationsService.create(req.user.id, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user applications' })
  findMyApplications(@Req() req: any) {
    return this.applicationsService.findByCreator(req.user.id);
  }

  @Get('project/:projectId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get all applications for a specific project (Admin only)' })
  findByProject(@Param('projectId') projectId: string) {
    return this.applicationsService.findByProject(projectId);
  }

  @Put(':id/status')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update application status (Admin only)' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.applicationsService.updateStatus(id, dto);
  }
}
