import { Controller, Post, Put, Get, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ClientViewsService } from './client-views.service';
import { SendToClientDto } from './dto/send-to-client.dto';
import { ClientViewDecisionDto } from './dto/client-view-decision.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('client-views')
@Controller()
export class ClientViewsController {
  constructor(private readonly clientViewsService: ClientViewsService) {}

  @Post('projects/:id/send-to-client')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Generate a client view token and email the link' })
  sendToClient(@Param('id') projectId: string, @Body() dto: SendToClientDto, @Req() req: any) {
    return this.clientViewsService.sendToClient(projectId, req.user.id, dto);
  }

  @Get('projects/:id/client-views')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get all client views generated for a project' })
  getProjectClientViews(@Param('id') projectId: string) {
    return this.clientViewsService.getProjectClientViews(projectId);
  }

  @Put('client-views/:id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Deactivate a specific client view link' })
  deactivate(@Param('id') id: string) {
    return this.clientViewsService.deactivate(id);
  }

  @Public()
  @Get('client-view/:token')
  @ApiOperation({ summary: 'Get shortlist details for a client view token' })
  getClientView(@Param('token') token: string) {
    return this.clientViewsService.getShortlistByToken(token);
  }

  @Public()
  @Post('client-view/:token/decision')
  @ApiOperation({ summary: 'Submit a decision for a creator in the shortlist' })
  submitDecision(@Param('token') token: string, @Body() dto: ClientViewDecisionDto) {
    return this.clientViewsService.submitDecision(token, dto);
  }
}
