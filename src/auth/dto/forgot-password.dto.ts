import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@adsoleo.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}
