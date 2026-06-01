import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDeviceDto {
  @ApiProperty({ description: 'The FCM token for push notifications' })
  @IsString()
  @IsNotEmpty()
  fcmToken: string;

  @ApiProperty({ description: 'The platform of the device (e.g. ios, android)' })
  @IsString()
  @IsNotEmpty()
  platform: string;
}
