import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AnalyticsService } from './analytics.service';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('analytics')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Agency-wide KPI overview (admin only)' })
  getOverview() {
    return this.analyticsService.getOverview();
  }

  @Get('creators')
  @ApiOperation({ summary: 'Creator performance leaderboard (admin only)' })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['approvalRate', 'applicationsCount', 'selectedCount'],
    example: 'approvalRate',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  getCreatorLeaderboard(
    @Query('sort') sort: 'approvalRate' | 'applicationsCount' | 'selectedCount' = 'approvalRate',
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.analyticsService.getCreatorLeaderboard({
      sort,
      page: Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(100, parseInt(limit, 10) || 20),
    });
  }

  @Get('projects/:id')
  @ApiOperation({ summary: 'Per-project analytics breakdown (admin only)' })
  getProjectStats(@Param('id') id: string) {
    return this.analyticsService.getProjectStats(id);
  }
}
