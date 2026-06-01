import { Controller, Get, Post, Body, Put, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProjectStatus } from '@prisma/client';

@ApiTags('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a new project (Admin only)' })
  create(@Body() createProjectDto: CreateProjectDto, @Req() req: any) {
    return this.projectsService.create(createProjectDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all projects (Scoped by role)' })
  @ApiQuery({ name: 'status', required: false, enum: ProjectStatus })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(
    @Req() req: any,
    @Query('status') status?: ProjectStatus,
    @Query('search') search?: string,
  ) {
    return this.projectsService.findAll(req.user.role, status, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single project (Scoped by role)' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.projectsService.findOne(id, req.user.role);
  }

  @Put(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a project (Admin only)' })
  update(@Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto) {
    return this.projectsService.update(id, updateProjectDto);
  }
}
