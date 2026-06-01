import { Controller, Post, Body, Get, Req, HttpCode } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';

interface RequestWithUser {
  user: { id: string; email: string; role: Role };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login via email and password' })
  @ApiResponse({ status: 200, description: 'Successful login' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed' })
  async refresh(@Body() refreshDto: RefreshDto) {
    return this.authService.refresh(refreshDto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiResponse({
    status: 200,
    description: 'If email exists, a reset link will be sent',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reset password using the token sent to email' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout (client discards tokens)' })
  @ApiResponse({ status: 200 })
  logout() {
    return { success: true };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@Req() req: RequestWithUser) {
    const count = await this.prisma.notification.count({
      where: {
        userId: req.user.id,
        readAt: null,
      },
    });

    return {
      ...req.user,
      unreadNotificationsCount: count,
    };
  }

  @Get('admin-ping')
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin-only smoke endpoint (M1 acceptance check)' })
  adminPing(@Req() req: RequestWithUser) {
    return { ok: true, role: req.user.role };
  }

  @Get('creator-ping')
  @Roles(Role.CREATOR)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Creator-only smoke endpoint (M1 acceptance check)',
  })
  creatorPing(@Req() req: RequestWithUser) {
    return { ok: true, role: req.user.role };
  }
}
