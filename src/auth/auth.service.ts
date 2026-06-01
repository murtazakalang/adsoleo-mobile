import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { EmailService } from '../email/email.service';

interface TokenPayload {
  sub: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.generateTokens(user.id, user.role);
  }

  async refresh(refreshDto: RefreshDto) {
    try {
      const payload = this.jwtService.verify<TokenPayload>(
        refreshDto.refreshToken,
        {
          secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        },
      );

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid token');
      }

      return this.generateTokens(user.id, user.role);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      // Don't leak whether user exists or not, just return success
      return { success: true };
    }

    // Generate random 32-byte token
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(token, 10);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

    await this.prisma.passwordResetToken.create({
      data: {
        token: hashedToken,
        userId: user.id,
        expiresAt,
      },
    });

    // Send email (mock template ID and data for now)
    await this.emailService.sendEmail({
      to: user.email,
      templateId: 'd-mock-template-id',
      dynamicTemplateData: { resetToken: token },
    });

    return { success: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const activeTokens = await this.prisma.passwordResetToken.findMany({
      where: { expiresAt: { gt: new Date() } },
    });

    type TokenRecord = (typeof activeTokens)[number];
    let matchedTokenRecord: TokenRecord | null = null;
    for (const record of activeTokens) {
      if (await bcrypt.compare(dto.token, record.token)) {
        matchedTokenRecord = record;
        break;
      }
    }

    if (!matchedTokenRecord) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.user.update({
      where: { id: matchedTokenRecord.userId },
      data: { passwordHash: hashedPassword },
    });

    // Clean up used tokens for this user
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: matchedTokenRecord.userId },
    });

    return { success: true };
  }

  private generateTokens(userId: string, role: string) {
    const payload: TokenPayload = { sub: userId, role };
    const accessExpiresIn =
      this.configService.getOrThrow<string>('JWT_EXPIRATION');
    const refreshExpiresIn = this.configService.getOrThrow<string>(
      'JWT_REFRESH_EXPIRATION',
    );
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: accessExpiresIn as unknown as number,
    });
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: refreshExpiresIn as unknown as number,
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }
}
