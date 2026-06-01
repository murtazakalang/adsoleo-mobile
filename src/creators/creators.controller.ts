import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
  Res,
  Req,
  ForbiddenException,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { CreatorsService } from './creators.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateCreatorDto } from './dto/create-creator.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthedUser {
  id: string;
  role: Role;
}

function resolveUserId(idParam: string, user: AuthedUser): string {
  if (idParam === 'me') return user.id;
  if (user.role !== Role.ADMIN && user.id !== idParam) {
    throw new ForbiddenException('You can only access your own profile');
  }
  return idParam;
}

@ApiTags('creators')
@ApiBearerAuth()
@Controller('creators')
export class CreatorsController {
  constructor(private readonly creatorsService: CreatorsService) {}

  // ── Admin: list creators ────────────────────────────────────────────────
  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all creator accounts (admin only)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'search', required: false, example: 'sophie' })
  listCreators(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    return this.creatorsService.listCreators({
      page: Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(100, parseInt(limit, 10) || 20),
      search,
    });
  }

  // ── Admin: create a creator account ────────────────────────────────────
  @Post()
  @Roles(Role.ADMIN)
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new creator account (admin only)' })
  createCreator(@Body() dto: CreateCreatorDto) {
    return this.creatorsService.createCreator(dto);
  }

  // ── Shared: get profile ─────────────────────────────────────────────────
  @Get(':id')
  @ApiOperation({ summary: 'Get creator profile and media metadata' })
  getProfile(
    @Param('id') id: string,
    @Req() req: { user: AuthedUser },
  ) {
    const userId = resolveUserId(id, req.user);
    return this.creatorsService.getProfileByUserId(userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update creator profile info' })
  updateProfile(
    @Param('id') id: string,
    @Body() dto: UpdateProfileDto,
    @Req() req: { user: AuthedUser },
  ) {
    const userId = resolveUserId(id, req.user);
    return this.creatorsService.updateProfile(userId, dto);
  }

  @Post(':id/media')
  @ApiOperation({ summary: 'Upload media directly to Postgres' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadMedia(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { user: AuthedUser },
  ) {
    const userId = resolveUserId(id, req.user);
    return this.creatorsService.uploadMedia(userId, file);
  }

  @Get('media/:mediaId')
  @Public()
  @ApiOperation({ summary: 'Serve raw media bytes' })
  async getMediaImage(
    @Param('mediaId') mediaId: string,
    @Res() res: Response,
  ) {
    const { imageBytes, mimeType } =
      await this.creatorsService.getMediaBytes(mediaId);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.send(imageBytes);
  }
}

